import { createServiceClient } from '@/lib/supabase/server'

/**
 * Returns the correct template for a given step and contact,
 * implementing 50/50 A/B split by alternating assignments.
 * Falls back to variant A if only one variant exists.
 */
export async function pickTemplateForStep(
  step: number,
  contactIndex: number
): Promise<string | null> {
  const supabase = await createServiceClient()

  const { data: templates } = await supabase
    .from('pitch_templates')
    .select('id, variant')
    .eq('step', step)
    .eq('is_active', true)

  if (!templates?.length) return null

  const variantA = templates.filter(t => t.variant === 'A')
  const variantB = templates.filter(t => t.variant === 'B')

  // If both variants exist, alternate by contact index
  if (variantA.length && variantB.length) {
    const pool = contactIndex % 2 === 0 ? variantA : variantB
    return pool[0]?.id ?? null
  }

  // Fall back to whatever is available
  return templates[0]?.id ?? null
}

/**
 * API route handler for manually re-assigning A/B variants to queued sequences.
 * Useful after adding a new template variant.
 */
export async function reassignABVariants(leadId: string): Promise<number> {
  const supabase = await createServiceClient()

  const { data: sequences } = await supabase
    .from('sequences')
    .select('id, step, contact_id')
    .eq('lead_id', leadId)
    .is('sent_at', null)

  if (!sequences?.length) return 0

  // Group by contact to get contact index
  const contactOrder: Record<string, number> = {}
  let idx = 0
  for (const seq of sequences) {
    if (!(seq.contact_id in contactOrder)) {
      contactOrder[seq.contact_id] = idx++
    }
  }

  let updated = 0
  for (const seq of sequences) {
    const templateId = await pickTemplateForStep(seq.step, contactOrder[seq.contact_id])
    if (templateId) {
      await supabase.from('sequences').update({ template_id: templateId }).eq('id', seq.id)
      updated++
    }
  }

  return updated
}
