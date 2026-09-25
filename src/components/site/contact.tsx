import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Check, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import * as React from "react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/locale-context";
import { BookingCalendar } from "@/components/ui/booking-calendar";
import { CAL_EVENT_TYPE, CAL_USERNAME } from "@/lib/constants";
import { submitContactMessage } from "@/server/functions/contact";

type TFn = ReturnType<typeof useLocale>["t"];

// Messages d'erreur localisés : reconstruit à chaque rendu pour suivre la locale.
const createContactSchema = (t: TFn) =>
  z.object({
    name: z.string({ required_error: t("form.error.required") }).min(2, t("form.error.nameMin")),
    email: z.string({ required_error: t("form.error.required") }).email(t("form.error.email")),
    company: z.string().optional(),
    budget: z.string().optional(),
    message: z
      .string({ required_error: t("form.error.required") })
      .min(10, t("form.error.messageMin")),
    // Honeypot anti-spam (champ invisible, jamais affiché ni persisté).
    website: z.string().max(500).optional(),
  });

type FormData = z.infer<ReturnType<typeof createContactSchema>>;

export function Contact() {
  const { t, locale } = useLocale();
  const [sendState, setSendState] = useState<"idle" | "sent" | "error">("idle");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({ resolver: zodResolver(createContactSchema(t)) });

  const onSubmit = async (data: FormData) => {
    setSendState("idle");
    try {
      await submitContactMessage({
        data: {
          name: data.name,
          email: data.email,
          company: data.company || "",
          budget: data.budget || "",
          message: data.message,
          locale,
          website: data.website ?? "",
        },
      });
      setSendState("sent");
      reset();
    } catch {
      setSendState("error");
    }
  };

  return (
    <section id="contact" className="relative py-24 md:py-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-radial-fade opacity-60 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_100%,black,transparent)]"
      />

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
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
            {t("contact.title")}
          </h1>
          <p className="mt-5 text-balance text-base text-muted-foreground sm:text-lg">
            {t("contact.subtitle")}
          </p>
        </motion.div>

        <div className="mx-auto mt-16 flex max-w-4xl flex-col gap-8">
          {/* Booking Calendar */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
          >
            <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--foreground)_25%,transparent)] sm:p-10">
              <BookingCalendar username={CAL_USERNAME} eventType={CAL_EVENT_TYPE} />
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--foreground)_25%,transparent)] sm:p-10"
            >
              <div className="mb-6">
                <h3 className="text-2xl font-semibold tracking-tight">{t("contact.form.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("contact.form.hint")}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="contact-name"
                  label={t("form.name")}
                  error={errors.name?.message}
                  required
                >
                  <Input {...register("name")} placeholder={t("form.namePh")} />
                </Field>
                <Field
                  id="contact-email"
                  label={t("form.email")}
                  error={errors.email?.message}
                  required
                >
                  <Input type="email" {...register("email")} placeholder={t("form.emailPh")} />
                </Field>
                <Field id="contact-company" label={t("form.company")}>
                  <Input {...register("company")} placeholder={t("form.companyPh")} />
                </Field>
                <Field id="contact-budget" label={t("form.budget")}>
                  <select
                    {...register("budget")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {t("form.budget.none")}
                    </option>
                    <option>{t("form.budget.low")}</option>
                    <option>{t("form.budget.mid")}</option>
                    <option>{t("form.budget.high")}</option>
                    <option>{t("form.budget.vhigh")}</option>
                  </select>
                </Field>
              </div>

              <div className="mt-5">
                <Field
                  id="contact-message"
                  label={t("form.message")}
                  error={errors.message?.message}
                  required
                >
                  <Textarea rows={5} {...register("message")} placeholder={t("form.messagePh")} />
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
                <div className="flex flex-col items-end gap-2">
                  {sendState === "sent" && (
                    <p
                      role="status"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-green-800 dark:text-green-300"
                    >
                      <Check className="size-4" aria-hidden="true" />
                      {t("form.success")}
                    </p>
                  )}
                  {sendState === "error" && (
                    <p role="alert" className="max-w-xs text-right text-sm text-destructive">
                      {t("form.error.send")}{" "}
                      <a
                        href={`mailto:${t("footer.contact.email")}`}
                        className="font-medium underline underline-offset-2"
                      >
                        {t("form.directEmail")}
                      </a>
                    </p>
                  )}
                  <Button type="submit" variant="brand" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> {t("form.submitting")}
                      </>
                    ) : sendState === "sent" ? (
                      <>
                        <Check className="size-4" /> {t("form.sent")}
                      </>
                    ) : (
                      <>
                        {t("form.submit")} <Send className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {/* Honeypot anti-spam : invisible aux humains comme aux lecteurs d'écran. */}
              <input
                {...register("website")}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="sr-only"
              />
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  required = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const errorId = `${id}-error`;
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        required,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined,
      })
    : children;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="text-brand">
            {" *"}
          </span>
        )}
      </Label>
      {child}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
