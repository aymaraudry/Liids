import { getNextApiKey } from '@/lib/pipeline/rotation'

export async function generatePersonalizedOpening(
  companyName: string,
  contactTitle: string,
  adPlatforms: string[],
  industry: string
): Promise<string> {
  const key = await getNextApiKey('gemini')
  if (!key) {
    // Fallback: generic opening
    return `I came across ${companyName} while researching ${industry} companies running ads on ${adPlatforms.join(' and ')}.`
  }

  const prompt = `Write a single personalized opening sentence (max 25 words) for a cold email to a ${contactTitle} at ${companyName}, a ${industry} company actively running ads on ${adPlatforms.join(', ')}. 
The opening should feel genuine, reference something specific about their growth or ad activity, and naturally lead into a UGC content pitch.
Reply with ONLY the sentence — no quotes, no preamble.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key.key_value}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 60, temperature: 0.8 },
        }),
      }
    )

    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return text || `I noticed ${companyName} is scaling its paid acquisition across ${adPlatforms.join(' and ')}.`
  } catch (err) {
    console.warn('[Gemini] Personalization failed:', err)
    return `I noticed ${companyName} is actively investing in paid ads on ${adPlatforms.join(' and ')}.`
  }
}
