import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/components/common/page-transition";

export function PageHeader({
  backHref,
  title,
  subtitle,
  actions,
  icon,
}: {
  backHref?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="mb-6"
    >
      <motion.div
        variants={staggerItem}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors mb-2"
            >
              <ArrowLeft className="size-3.5" /> Back
            </Link>
          )}
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-on-surface">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm font-medium text-on-surface-variant mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </motion.div>
    </motion.div>
  );
}

export { staggerContainer, staggerItem };