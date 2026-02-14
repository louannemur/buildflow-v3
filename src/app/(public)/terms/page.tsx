import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Calypso",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: February 14, 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Acceptance of Terms
          </h2>
          <p className="mt-2">
            By accessing or using Calypso (&quot;the Service&quot;), you agree
            to be bound by these Terms of Service. If you do not agree, do not
            use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Description of Service
          </h2>
          <p className="mt-2">
            Calypso is a web-based design and development platform that enables
            users to create, manage, and build digital projects. We reserve the
            right to modify or discontinue features at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Accounts
          </h2>
          <p className="mt-2">
            You are responsible for maintaining the security of your account
            credentials. You must provide accurate information when creating an
            account. You are responsible for all activity that occurs under your
            account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Subscriptions &amp; Billing
          </h2>
          <p className="mt-2">
            Paid plans are billed in advance on a monthly or yearly basis.
            Refunds are handled on a case-by-case basis. You may cancel your
            subscription at any time; access continues until the end of the
            current billing period.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Intellectual Property
          </h2>
          <p className="mt-2">
            You retain ownership of all content you create using the Service.
            Calypso retains ownership of the platform, its design, and
            underlying technology.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Acceptable Use
          </h2>
          <p className="mt-2">
            You agree not to use the Service for any unlawful purpose, to
            harass others, to distribute malware, or to attempt to gain
            unauthorized access to the Service or its systems.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Limitation of Liability
          </h2>
          <p className="mt-2">
            The Service is provided &quot;as is&quot; without warranties of any
            kind. Calypso shall not be liable for any indirect, incidental, or
            consequential damages arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Changes to Terms
          </h2>
          <p className="mt-2">
            We may update these terms from time to time. Continued use of the
            Service constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
          <p className="mt-2">
            Questions about these terms? Contact us at{" "}
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
