import { ApplicationReview } from "@/modules/admin/components/ApplicationReview";
export default async function Page({params}:{params:Promise<{id:string}>}) { const {id}=await params; return <ApplicationReview id={id}/>; }
