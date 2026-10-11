import { uploadRoute } from "@/server/uploads";

export const { GET, generateStaticParams } = uploadRoute("uploads");

export const dynamic = "force-static";
export const dynamicParams = false;
