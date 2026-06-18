'use client'

interface Props {
  memberId: string
  currentRole: string
  updateAction: (formData: FormData) => Promise<void>
}

export default function RoleSelect({ memberId, currentRole, updateAction }: Props) {
  return (
    <form action={updateAction}>
      <input type="hidden" name="member_id" value={memberId} />
      <select
        name="role"
        defaultValue={currentRole}
        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="admin">Admin</option>
        <option value="member">Medlem</option>
        <option value="guest">Gæst</option>
      </select>
    </form>
  )
}
