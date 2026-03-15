import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | InstaCRUD",
  description: "Privacy Policy for InstaCRUD platform",
};

export default function PrivacyPolicy() {
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
          Privacy Policy
        </h1>

        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: January 2025
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              1. Introduction
            </h2>
            <p>
              This Privacy Policy describes how we collect, use, and protect your personal
              information when you use our service. By using the service, you agree to the
              collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              2. Information We Collect
            </h2>
            <p>We may collect the following types of information:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong>Account Information:</strong> Name, email address, and password when you
                create an account
              </li>
              <li>
                <strong>Usage Data:</strong> Information about how you interact with the service,
                including pages visited, features used, and actions taken
              </li>
              <li>
                <strong>Device Information:</strong> Browser type, operating system, IP address,
                and device identifiers
              </li>
              <li>
                <strong>Content:</strong> Any data or content you upload, create, or store within
                the service
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              3. How We Use Your Information
            </h2>
            <p>We use the collected information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Provide, maintain, and improve the service</li>
              <li>Authenticate users and secure accounts</li>
              <li>Communicate with you about the service, including updates and support</li>
              <li>Monitor and analyze usage patterns to enhance user experience</li>
              <li>Detect, prevent, and address technical issues or security threats</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              4. Data Sharing
            </h2>
            <p>
              We do not sell your personal information. We may share your information only in
              the following circumstances:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>With your consent or at your direction</li>
              <li>With service providers who assist in operating the service</li>
              <li>To comply with legal requirements or respond to lawful requests</li>
              <li>To protect our rights, privacy, safety, or property</li>
              <li>In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              5. Data Security
            </h2>
            <p>
              We implement reasonable security measures to protect your information from
              unauthorized access, alteration, disclosure, or destruction. However, no method
              of transmission over the Internet or electronic storage is completely secure,
              and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              6. Data Retention
            </h2>
            <p>
              We retain your information for as long as your account is active or as needed to
              provide you with the service. We may also retain certain information as required
              by law or for legitimate business purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              7. Your Rights
            </h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal
              information, including:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Access to your personal information</li>
              <li>Correction of inaccurate or incomplete data</li>
              <li>Deletion of your personal information</li>
              <li>Data portability</li>
              <li>Objection to or restriction of certain processing</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us through the appropriate channels
              provided within the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              8. Cookies and Tracking
            </h2>
            <p>
              We may use cookies and similar tracking technologies to collect usage information
              and improve the service. You can control cookies through your browser settings,
              though disabling cookies may affect functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              9. Third-Party Services
            </h2>
            <p>
              The service may contain links to third-party websites or integrate with third-party
              services. We are not responsible for the privacy practices of these third parties.
              We encourage you to review their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              10. Children&apos;s Privacy
            </h2>
            <p>
              The service is not intended for users under 18 years of age. We do not knowingly
              collect personal information from children. If you become aware that a child has
              provided us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              11. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              changes by posting the new Privacy Policy on this page with an updated revision
              date. Your continued use of the service after such changes constitutes acceptance
              of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              12. Contact
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us through
              the appropriate channels provided within the service.
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
