import { uploadRoute } from "@/server/uploads";

export const { GET, generateStaticParams } = uploadRoute("img");

export const dynamic = "force-static";
export const dynamicParams = false;
