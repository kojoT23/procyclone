// AI-powered trending product suggestions.
//
// Calls the Anthropic Messages API with the web_search tool so Claude
// pulls REAL, current trending-product data from the web rather than
// making something up from stale training knowledge.
//
// Requires ANTHROPIC_API_KEY in your .env (get one at
// https://console.anthropic.com/settings/keys). This key must be kept
// server-side only — never expose it to the frontend.

const getTrendingSuggestions = async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('getTrendingSuggestions: ANTHROPIC_API_KEY is not set');
      return res.status(500).json({
        success: false,
        message: 'AI suggestions are not configured on the server yet',
      });
    }

    const { category, region } = req.query;
    const focus = category ? `in the "${category}" category` : 'across popular e-commerce categories';
    const locationHint = region ? ` for the ${region} market` : '';

    const prompt = `Search the web for currently trending, best-selling consumer
products ${focus}${locationHint} that a small online store could realistically
stock and resell right now. Use real, current information from your search —
do not invent products or guess from memory.

Respond with ONLY a JSON array (no markdown fences, no preamble, no
commentary — just the raw array) of 6 to 10 objects, each shaped exactly
like this:
{
  "name": "string - a specific, real product name",
  "category": "string - a short category label",
  "description": "string - 1-2 sentences suitable for a store listing",
  "suggested_price_range": "string - e.g. 'GH₵50-80'",
  "why_trending": "string - 1 sentence on why it's trending right now"
}`;

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2048,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errText);
      return res.status(502).json({ success: false, message: 'Failed to reach the AI suggestion service' });
    }

    const data = await apiRes.json();

    // A web-search-enabled response interleaves "text", "server_tool_use",
    // and "web_search_tool_result" blocks. Only "text" blocks are Claude's
    // actual written output, and there can be more than one — collect them
    // all before parsing.
    const rawText = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    let suggestions;
    try {
      const cleaned = rawText.replace(/^```json\s*|```\s*$/g, '').trim();
      suggestions = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse AI suggestions as JSON. Raw text:', rawText);
      return res.status(502).json({ success: false, message: 'AI response was not valid — please try again' });
    }

    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('getTrendingSuggestions error:', error);
    res.status(500).json({ success: false, message: 'Server error generating suggestions' });
  }
};

module.exports = { getTrendingSuggestions };
