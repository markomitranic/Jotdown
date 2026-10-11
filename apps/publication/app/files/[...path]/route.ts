import { uploadRoute } from "@/server/uploads";

export const { GET, generateStaticParams } = uploadRoute("files");

export const dynamic = "force-static";
export const dynamicParams = false;
