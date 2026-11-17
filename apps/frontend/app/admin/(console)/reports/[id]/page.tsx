import { ReportDetail } from "@/modules/admin/components/ReportDetail";
export default async function Page({params}:{params:Promise<{id:string}>}) {const {id}=await params;return <ReportDetail id={id}/>;}
