'use server'

import { createServiceClient } from '@/lib/supabase/service'

export async function markTokenUsed(tokenId: string) {
  const supabase = createServiceClient()
  await supabase
    .from('invite_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenId)
}
