"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ums/page-header";
import { FeeSlipList } from "@/components/ums/fee-slip-list";
import { PaymentsTab } from "@/components/ums/payments-tab";
import { listFeeSlips } from "@/server/ums";
import { authClient } from "@/lib/auth-client";

type Slip = Awaited<ReturnType<typeof listFeeSlips>>[number];

export default function PaymentsPage() {
  const { data: session, isPending } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";

  const [slips, setSlips] = useState<Slip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    listFeeSlips()
      .then(setSlips)
      .catch(() => toast.error("Could not load your fee slips"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isPending) load();
  }, [load, isPending]);

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Payments"
        subtitle={
          isAdmin
            ? "Record what each student paid and issue their fee slip."
            : "Your fee slips. Open any slip online or download a copy."
        }
        icon={<Wallet className="size-7 text-primary" />}
      />

      <div className="max-w-5xl">
        {isAdmin ? (
          <PaymentsTab />
        ) : loading ? (
          <div className="rounded-3xl border border-outline-variant/60 p-10 text-center text-sm text-on-surface-variant">
            Loading…
          </div>
        ) : (
          <FeeSlipList
            slips={slips}
            emptyMessage="You have no fee slips yet."
          />
        )}
      </div>
    </div>
  );
}