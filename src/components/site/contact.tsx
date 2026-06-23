import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Calendar, Check, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/locale-context";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  company: z.string().optional(),
  budget: z.string().optional(),
  message: z.string().min(10),
});

type FormData = z.infer<typeof schema>;

export function Contact() {
  const { t } = useLocale();
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    await new Promise((r) => setTimeout(r, 900));
    console.log("Contact submission", data);
    setSubmitted(true);
    reset();
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <section id="contact" className="relative py-24 md:py-32">
      <div className="absolute inset-0 -z-10 bg-radial-fade opacity-60 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_100%,black,transparent)]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
            {t("contact.eyebrow")}
          </span>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
            {t("contact.title")}
          </h2>
          <p className="mt-5 text-balance text-base text-muted-foreground sm:text-lg">
            {t("contact.subtitle")}
          </p>
        </motion.div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-6 lg:grid-cols-5">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-3"
          >
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--foreground)_25%,transparent)] sm:p-10"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t("form.name")} error={errors.name?.message}>
                  <Input {...register("name")} placeholder="Jane Doe" />
                </Field>
                <Field label={t("form.email")} error={errors.email?.message}>
                  <Input type="email" {...register("email")} placeholder="jane@brand.com" />
                </Field>
                <Field label={t("form.company")}>
                  <Input {...register("company")} placeholder="Acme Inc." />
                </Field>
                <Field label={t("form.budget")}>
                  <select
                    {...register("budget")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue=""
                  >
                    <option value="" disabled>—</option>
                    <option>&lt; 10k €</option>
                    <option>10k – 30k €</option>
                    <option>30k – 80k €</option>
                    <option>80k+ €</option>
                  </select>
                </Field>
              </div>

              <div className="mt-5">
                <Field label={t("form.message")} error={errors.message?.message}>
                  <Textarea rows={5} {...register("message")} placeholder="..." />
                </Field>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-brand" /> {t("trust.badge2")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-brand" /> {t("trust.badge1")}
                  </span>
                </div>
                <Button type="submit" variant="brand" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> {t("form.submitting")}
                    </>
                  ) : submitted ? (
                    <>
                      <Check className="size-4" /> {t("form.success")}
                    </>
                  ) : (
                    <>
                      {t("form.submit")} <Send className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>

          {/* Calendly placeholder */}
          <motion.aside
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8">
              <div className="flex items-center gap-2 text-brand">
                <Calendar className="size-4" />
                <span className="text-xs font-medium uppercase tracking-[0.2em]">
                  {t("form.calendly")}
                </span>
              </div>
              <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight">
                30 min · Free intro call
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick a slot and we'll align on scope, timeline and budget.
              </p>

              {/* Calendly iframe wrapper */}
              <div
                data-calendly-embed
                className="mt-6 flex flex-1 min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 p-6 text-center"
              >
                <div className="text-xs text-muted-foreground">
                  <Calendar className="mx-auto mb-2 size-6 opacity-50" />
                  {t("form.calendlyHint")}
                  <div className="mt-1 font-mono opacity-50">
                    &lt;iframe src="calendly.com/webxia/30min" /&gt;
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                {t("trust.badge3")}
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
