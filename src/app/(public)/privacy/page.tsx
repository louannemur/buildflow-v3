import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Calypso",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: February 14, 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Information We Collect
          </h2>
          <p className="mt-2">
            We collect information you provide directly: your name, email
            address, and payment information when you subscribe. We also
            collect usage data such as pages visited and features used to
            improve the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. How We Use Your Information
          </h2>
          <p className="mt-2">
            We use your information to provide and maintain the Service,
            process payments, send transactional emails, and improve the user
            experience. We do not sell your personal information to third
            parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Data Storage &amp; Security
          </h2>
          <p className="mt-2">
            Your data is stored securely using industry-standard encryption.
            We use trusted third-party services including Neon (database),
            Stripe (payments), and Vercel (hosting). Each provider maintains
            their own security and compliance standards.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Cookies &amp; Tracking
          </h2>
          <p className="mt-2">
            We use essential cookies for authentication and session management.
            We do not use third-party advertising trackers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Third-Party Services
          </h2>
          <p className="mt-2">
            We integrate with third-party services to provide functionality.
            These include Stripe for payment processing, Resend for email
            delivery, and Anthropic for AI-powered features. Each service has
            its own privacy policy governing your data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Your Rights
          </h2>
          <p className="mt-2">
            You may request access to, correction of, or deletion of your
            personal data at any time by contacting us. You may also delete
            your account through the settings page.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Data Retention
          </h2>
          <p className="mt-2">
            We retain your data for as long as your account is active. If you
            delete your account, we will remove your personal data within 30
            days, except where required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Changes to This Policy
          </h2>
          <p className="mt-2">
            We may update this privacy policy from time to time. We will notify
            you of material changes via email or through the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
          <p className="mt-2">
            Questions about your privacy? Contact us at{" "}
            <a
              href="mailto:info@calypso.build"
              className="text-foreground underline underline-offset-4"
            >
              info@calypso.build
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-12">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
