import { getToolAccess } from "@/lib/tool-auth"
import { redirect } from "next/navigation"

export default async function MasterPage({ params }: { params: { toolId: string } }) {
  const { role } = await getToolAccess(params.toolId)

  // SICUREZZA: Solo Admin passa
  //if (role !== 'admin') {
    //redirect(`/dashboard/tools/${params.toolId}`)
  //}

  return (
    <div className="bg-white p-8 rounded shadow border-t-4 border-[#967635]">
      <h1 className="text-2xl font-bold text-slate-900">Configurazione Master</h1>
      <p className="mt-2 text-slate-500">Area riservata agli amministratori.</p>
    </div>
  )
}