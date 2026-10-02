import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
    title: "Dashboard",
    robots: { index: false, follow: false },
};

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/");
    }

    return <DashboardClient user={session.user} />;
}