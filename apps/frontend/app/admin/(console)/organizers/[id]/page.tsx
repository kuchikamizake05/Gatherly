import { OrganizerDetail } from "@/modules/admin/components/OrganizerDetail";
export default async function Page({params}:{params:Promise<{id:string}>}) {const {id}=await params;return <OrganizerDetail id={id}/>;}
