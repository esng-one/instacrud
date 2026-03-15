import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms and Conditions | InstaCRUD",
  description: "Terms and Conditions for using InstaCRUD platform",
};

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href="/signup"
            className="text-brand-500 hover:text-brand-600 dark:text-brand-400 text-sm"
          >
            &larr; Back to Sign Up
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Terms and Conditions
        </h1>

        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: January 2025
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              1. Agreement to Terms
            </h2>
            <p>
              By accessing or using our service, you agree to be bound by these Terms and Conditions.
              If you disagree with any part of these terms, you may not access the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              2. Eligibility
            </h2>
            <p>
              You must be at least 18 years of age to use this service. By using this service,
              you represent and warrant that you are at least 18 years old and have the legal
              capacity to enter into these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              3. User Accounts
            </h2>
            <p>
              When you create an account, you must provide accurate, complete, and current information.
              You are responsible for safeguarding your account credentials and for all activities
              that occur under your account. You agree to notify us immediately of any unauthorized
              use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              4. Acceptable Use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Use the service for any unlawful purpose or in violation of any applicable laws</li>
              <li>Attempt to gain unauthorized access to any part of the service</li>
              <li>Interfere with or disrupt the service or servers connected to the service</li>
              <li>Upload or transmit viruses, malware, or other malicious code</li>
              <li>Use the service to infringe on the intellectual property rights of others</li>
              <li>Harass, abuse, or harm other users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              5. Intellectual Property
            </h2>
            <p>
              The service and its original content, features, and functionality are owned by us
              and are protected by international copyright, trademark, and other intellectual
              property laws. You retain ownership of any content you submit to the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              6. Disclaimer of Warranties
            </h2>
            <p>
              THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT
              WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE
              SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. YOU USE THE SERVICE AT
              YOUR OWN RISK.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              7. Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
              DATA, USE, OR GOODWILL, RESULTING FROM YOUR ACCESS TO OR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              8. Payment and Refunds
            </h2>
            <p>
              If applicable, payment terms will be specified at the time of purchase. All payments
              are non-refundable unless otherwise required by applicable law. We reserve the right
              to modify pricing at any time with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              9. Termination
            </h2>
            <p>
              We may terminate or suspend your account and access to the service immediately,
              without prior notice or liability, for any reason, including breach of these Terms.
              Upon termination, your right to use the service will cease immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              10. Changes to Terms
            </h2>
            <p>
              We reserve the right to modify these Terms at any time. We will provide notice of
              significant changes by posting the new Terms on this page with an updated revision date.
              Your continued use of the service after such changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              11. Governing Law
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws,
              without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              12. Contact
            </h2>
            <p>
              If you have any questions about these Terms, please contact us through the
              appropriate channels provided within the service.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/signup"
            className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            &larr; Back to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
