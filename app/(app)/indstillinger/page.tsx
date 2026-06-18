import { createClient } from '@/lib/supabase/server'
import {
  updateFamilyName,
  updateMemberColor,
  updateMemberRole,
  generateInviteLink,
  addAulaFeed,
  createManagedMember,
  updateManagedMember,
  deleteManagedMember,
  uploadAvatar,
} from './actions'
import { signOut } from '@/app/login/actions'
import AvatarUpload from '@/components/AvatarUpload'
import RoleSelect from '@/components/RoleSelect'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ''

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  member: 'Medlem',
  guest: 'Gæst',
}

export default async function IndstillingerPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, family_id, role, color')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const [familyResult, membersResult, managedResult, feedsResult, tokensResult] =
    await Promise.all([
      profile?.family_id
        ? supabase
            .from('families')
            .select('name')
            .eq('id', profile.family_id)
            .single()
        : { data: null },
      profile?.family_id
        ? supabase
            .from('users')
            .select('id, name, color, role, avatar_url')
            .eq('family_id', profile.family_id)
        : { data: [] },
      profile?.family_id
        ? supabase
            .from('managed_members')
            .select('id, name, color, avatar_url')
            .eq('family_id', profile.family_id)
            .order('created_at')
        : { data: [] },
      profile?.family_id
        ? supabase
            .from('aula_feeds')
            .select('*')
            .eq('family_id', profile.family_id)
        : { data: [] },
      profile?.family_id && isAdmin
        ? supabase
            .from('invite_tokens')
            .select('token, expires_at, used_at')
            .eq('family_id', profile.family_id)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(3)
        : { data: [] },
    ])

  const family = familyResult?.data
  const members = membersResult.data ?? []
  const managedMembers = managedResult.data ?? []
  const feeds = feedsResult.data ?? []
  const activeTokens = tokensResult.data ?? []

  return (
    <div className="pt-4 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Indstillinger</h1>

      {/* Family name */}
      {isAdmin && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Familie
          </h2>
          <form action={updateFamilyName} className="flex gap-2">
            <input
              name="name"
              type="text"
              defaultValue={family?.name ?? ''}
              placeholder="Familienavn"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              Gem
            </button>
          </form>
        </section>
      )}

      {/* Members */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Familiemedlemmer
        </h2>
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <AvatarUpload
                targetId={m.id}
                targetType="user"
                name={m.name}
                color={m.color}
                avatarUrl={m.avatar_url}
                uploadAction={uploadAvatar}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                <p className="text-xs text-gray-500">{ROLE_LABELS[m.role] ?? m.role}</p>
              </div>

              {/* Color picker (admin or self) */}
              {(isAdmin || m.id === user.id) && (
                <form action={updateMemberColor} className="flex gap-1">
                  <input type="hidden" name="member_id" value={m.id} />
                  <input
                    type="color"
                    name="color"
                    defaultValue={m.color}
                    onChange={() => {}}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                    title="Vælg farve"
                  />
                  <button
                    type="submit"
                    className="text-xs text-indigo-600 hover:underline px-1"
                  >
                    OK
                  </button>
                </form>
              )}

              {/* Role selector (admin only, not self) */}
              {isAdmin && m.id !== user.id && (
                <RoleSelect
                  memberId={m.id}
                  currentRole={m.role}
                  updateAction={updateMemberRole}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Managed members (children without accounts) */}
      {isAdmin && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Børn (uden login)
          </h2>

          {managedMembers.length > 0 && (
            <div className="space-y-2 mb-4">
              {managedMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <AvatarUpload
                    targetId={m.id}
                    targetType="managed"
                    name={m.name}
                    color={m.color}
                    avatarUrl={m.avatar_url}
                    uploadAction={uploadAvatar}
                  />
                  <span className="flex-1 text-sm font-medium text-gray-900">{m.name}</span>

                  {/* Inline edit — color */}
                  <form action={updateManagedMember} className="flex gap-1 items-center">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="name" value={m.name} />
                    <input
                      type="color"
                      name="color"
                      defaultValue={m.color}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                      title="Skift farve"
                    />
                    <button type="submit" className="text-xs text-indigo-600 hover:underline px-1">
                      OK
                    </button>
                  </form>

                  {/* Delete */}
                  <form action={deleteManagedMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-500 hover:underline"
                      title="Slet"
                    >
                      Slet
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {/* Add child form */}
          <form action={createManagedMember} className="flex gap-2 items-center">
            <input
              name="name"
              type="text"
              placeholder="Barnets navn"
              required
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="color"
              name="color"
              defaultValue="#22c55e"
              className="w-10 h-10 rounded cursor-pointer border border-gray-200 flex-shrink-0"
              title="Farve"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 whitespace-nowrap"
            >
              + Tilføj
            </button>
          </form>
        </section>
      )}

      {/* Invitation links */}
      {isAdmin && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Invitationslink
          </h2>

          {activeTokens.length > 0 && (
            <div className="mb-3 space-y-2">
              {activeTokens.map((t) => (
                <div key={t.token} className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${SITE_URL}/join/${t.token}`}
                    className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded bg-gray-50 font-mono truncate"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(`${SITE_URL}/join/${t.token}`)
                    }
                    className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
                  >
                    Kopiér
                  </button>
                </div>
              ))}
            </div>
          )}

          <form action={generateInviteLink}>
            <button
              type="submit"
              className="w-full py-2 border-2 border-dashed border-indigo-300 text-indigo-600 text-sm rounded-lg hover:bg-indigo-50 transition-colors"
            >
              + Generer nyt invitationslink
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-1">Links udløber efter 7 dage</p>
        </section>
      )}

      {/* Aula feeds */}
      {isAdmin && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Aula-kalender
          </h2>
          {feeds.length > 0 && (
            <div className="mb-3 space-y-1">
              {feeds.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700">{f.child_name}</span>
                  <span className="text-gray-400 text-xs truncate flex-1">{f.ics_url}</span>
                </div>
              ))}
            </div>
          )}
          <form action={addAulaFeed} className="space-y-2">
            <select
              name="user_id"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              required
            >
              <option value="">Vælg barn...</option>
              {managedMembers.length > 0 && (
                managedMembers.map((m) => (
                  <option key={`managed:${m.id}`} value={`managed:${m.id}`}>
                    {m.name} (barn)
                  </option>
                ))
              )}
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              name="child_name"
              type="text"
              placeholder="Barnets navn i Aula"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
            <input
              name="ics_url"
              type="url"
              placeholder="Aula .ics URL"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              required
            />
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              Tilføj Aula-feed
            </button>
          </form>
        </section>
      )}

      {/* Sign out */}
      <section className="pb-4">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full py-3 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Log ud
          </button>
        </form>
      </section>
    </div>
  )
}
