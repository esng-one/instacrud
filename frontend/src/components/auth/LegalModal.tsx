// components/auth/LegalModal.tsx
"use client";

import { Modal } from "@/components/ui/modal";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "terms" | "privacy";
}

export default function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  const handlePrint = () => {
    const title = type === "terms" ? "Terms and Conditions" : "Privacy Policy";
    const contentEl = document.getElementById("legal-content");
    if (!contentEl) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const doc = printWindow.document;
    doc.open();
    doc.write("<!DOCTYPE html><html><head></head><body></body></html>");
    doc.close();

    doc.title = title;

    const style = doc.createElement("style");
    style.textContent = `
      body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
      h2 { margin-bottom: 8px; }
      h3 { margin-top: 24px; }
      ul { padding-left: 24px; }
      li { margin: 4px 0; }
    `;
    doc.head.appendChild(style);

    const heading = doc.createElement("h2");
    heading.textContent = title;
    doc.body.appendChild(heading);

    const datePara = doc.createElement("p");
    datePara.style.cssText = "color: #666; margin-bottom: 24px;";
    datePara.textContent = "Last updated: January 2026";
    doc.body.appendChild(datePara);

    const contentClone = contentEl.cloneNode(true) as HTMLElement;
    doc.body.appendChild(contentClone);

    printWindow.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-3xl max-h-[90vh] p-0 overflow-hidden"
      showCloseButton
    >
      <div className="flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {type === "terms" ? "Terms and Conditions" : "Privacy Policy"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Last updated: January 2026
          </p>
        </div>

        <div id="legal-content" className="flex-1 overflow-y-auto p-6">
          {type === "terms" ? <TermsContent /> : <PrivacyContent />}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-center gap-3">
          <button
            onClick={handlePrint}
            className="px-6 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TermsContent() {
  return (
    <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">
      <section className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-3">
          Important Notice - Demo Service
        </h3>
        <p className="text-amber-700 dark:text-amber-300">
          <strong>This is a demonstration service intended solely for evaluation and testing purposes.</strong> This
          service is not intended for any real personal or commercial use. Data persistence is not
          guaranteed, and all data may be deleted at any time without prior notice. Do not store any
          sensitive, important, or irreplaceable information on this service.
        </p>
        <p className="text-amber-700 dark:text-amber-300 mt-2">
          ESNG One LLC provides this Service without any warranty, express or implied. You agree
          that any use of this Service is at your sole risk, and ESNG One LLC shall not be liable
          for any damages or losses resulting from your use of the Service.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          1. Interpretation and Definitions
        </h3>
        <p>
          The words of which the initial letter is capitalized have meanings defined under the
          following conditions. The following definitions shall have the same meaning regardless
          of whether they appear in singular or in plural.
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>
            <strong>Company</strong> (referred to as either &quot;the Company&quot;, &quot;We&quot;,
            &quot;Us&quot; or &quot;Our&quot; in this Agreement) refers to ESNG One LLC, 8735
            Dunwoody Place Ste R, Atlanta, GA, 30350.
          </li>
          <li>
            <strong>Country</strong> refers to: Georgia, United States
          </li>
          <li>
            <strong>Service</strong> refers to the Website and all related applications.
          </li>
          <li>
            <strong>You</strong> means the individual accessing or using the Service, or the
            company, or other legal entity on behalf of which such individual is accessing or
            using the Service, as applicable.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          2. Agreement to Terms
        </h3>
        <p>
          These are the Terms and Conditions governing the use of this Service and the agreement
          that operates between You and the Company. These Terms and Conditions set out the rights
          and obligations of all users regarding the use of the Service.
        </p>
        <p className="mt-2">
          By accessing or using the Service You agree to be bound by these Terms and Conditions.
          If You disagree with any part of these Terms and Conditions then You may not access the Service.
        </p>
        <p className="mt-2">
          Your access to and use of the Service is also conditioned on Your acceptance of and
          compliance with the Privacy Policy of the Company.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          3. Eligibility
        </h3>
        <p>
          You represent that you are over the age of 18. The Company does not permit those under
          18 to use the Service. By using this service, you represent and warrant that you are at
          least 18 years old and have the legal capacity to enter into these Terms.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          4. User Accounts
        </h3>
        <p>
          When you create an account, you must provide accurate, complete, and current information.
          You are responsible for safeguarding your account credentials and for all activities
          that occur under your account. You agree to notify us immediately of any unauthorized
          use of your account.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          5. Acceptable Use
        </h3>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Use the service for any unlawful purpose or in violation of any applicable laws</li>
          <li>Attempt to gain unauthorized access to any part of the service</li>
          <li>Interfere with or disrupt the service or servers connected to the service</li>
          <li>Upload or transmit viruses, malware, or other malicious code</li>
          <li>Use the service to infringe on the intellectual property rights of others</li>
          <li>Harass, abuse, or harm other users</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          6. Links to Other Websites
        </h3>
        <p>
          Our Service may contain links to third-party web sites or services that are not owned
          or controlled by the Company. The Company has no control over, and assumes no
          responsibility for, the content, privacy policies, or practices of any third party
          web sites or services.
        </p>
        <p className="mt-2">
          You further acknowledge and agree that the Company shall not be responsible or liable,
          directly or indirectly, for any damage or loss caused or alleged to be caused by or in
          connection with the use of or reliance on any such content, goods or services available
          on or through any such web sites or services.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          7. Intellectual Property
        </h3>
        <p>
          The service and its original content, features, and functionality are owned by us
          and are protected by international copyright, trademark, and other intellectual
          property laws. You retain ownership of any content you submit to the service.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          8. &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; Disclaimer
        </h3>
        <p className="uppercase text-sm">
          The Service is provided to You &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; and with all
          faults and defects without warranty of any kind. To the maximum extent permitted under
          applicable law, the Company, on its own behalf and on behalf of its Affiliates and its
          and their respective licensors and service providers, expressly disclaims all warranties,
          whether express, implied, statutory or otherwise, with respect to the Service, including
          all implied warranties of merchantability, fitness for a particular purpose, title and
          non-infringement, and warranties that may arise out of course of dealing, course of
          performance, usage or trade practice.
        </p>
        <p className="uppercase text-sm mt-2">
          Without limitation to the foregoing, the Company provides no warranty or undertaking, and
          makes no representation of any kind that the Service will meet Your requirements, achieve
          any intended results, be compatible or work with any other software, applications, systems
          or services, operate without interruption, meet any performance or reliability standards
          or be error free or that any errors or defects can or will be corrected.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          9. Limitation of Liability
        </h3>
        <p className="uppercase text-sm">
          Notwithstanding any damages that You might incur, the entire liability of the Company
          and any of its suppliers under any provision of this Terms and Your exclusive remedy
          for all of the foregoing shall be limited to the amount actually paid by You through
          the Service.
        </p>
        <p className="uppercase text-sm mt-2">
          To the maximum extent permitted by applicable law, in no event shall the Company or its
          suppliers be liable for any special, incidental, indirect, or consequential damages
          whatsoever (including, but not limited to, damages for loss of profits, loss of data or
          other information, for business interruption, for personal injury, loss of privacy arising
          out of or in any way related to the use of or inability to use the Service, third-party
          software and/or third-party hardware used with the Service, or otherwise in connection
          with any provision of this Terms), even if the Company or any supplier has been advised
          of the possibility of such damages and even if the remedy fails of its essential purpose.
        </p>
        <p className="text-sm mt-2">
          Some states do not allow the exclusion of implied warranties or limitation of liability
          for incidental or consequential damages, which means that some of the above limitations
          may not apply. In these states, each party&apos;s liability will be limited to the greatest
          extent permitted by law.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          10. Termination
        </h3>
        <p>
          We may terminate or suspend Your access immediately, without prior notice or liability,
          for any reason whatsoever, including without limitation if You breach these Terms and
          Conditions. Upon termination, Your right to use the Service will cease immediately.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          11. Governing Law
        </h3>
        <p>
          The laws of the Country (Georgia, United States), excluding its conflicts of law rules,
          shall govern this Terms and Your use of the Service. Your use of the Application may
          also be subject to other local, state, national, or international laws.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          12. Disputes Resolution
        </h3>
        <p>
          If You have any concern or dispute about the Service, You agree to first try to resolve
          the dispute informally by contacting the Company.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          13. For European Union (EU) Users
        </h3>
        <p>
          If You are a European Union consumer, you will benefit from any mandatory provisions
          of the law of the country in which You are resident.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          14. United States Legal Compliance
        </h3>
        <p>
          You represent and warrant that (i) You are not located in a country that is subject to
          the United States government embargo, or that has been designated by the United States
          government as a &quot;terrorist supporting&quot; country, and (ii) You are not listed on
          any United States government list of prohibited or restricted parties.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          15. Severability and Waiver
        </h3>
        <p>
          If any provision of these Terms is held to be unenforceable or invalid, such provision
          will be changed and interpreted to accomplish the objectives of such provision to the
          greatest extent possible under applicable law and the remaining provisions will continue
          in full force and effect.
        </p>
        <p className="mt-2">
          Except as provided herein, the failure to exercise a right or to require performance of
          an obligation under these Terms shall not affect a party&apos;s ability to exercise such
          right or require such performance at any time thereafter nor shall the waiver of a breach
          constitute a waiver of any subsequent breach.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          16. Changes to Terms
        </h3>
        <p>
          We reserve the right, at Our sole discretion, to modify or replace these Terms at any
          time. If a revision is material We will make reasonable efforts to provide at least 30
          days&apos; notice prior to any new terms taking effect. What constitutes a material change
          will be determined at Our sole discretion.
        </p>
        <p className="mt-2">
          By continuing to access or use Our Service after those revisions become effective, You
          agree to be bound by the revised terms. If You do not agree to the new terms, in whole
          or in part, please stop using the website and the Service.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          17. Contact Us
        </h3>
        <p>
          If you have any questions about these Terms and Conditions, You can contact us:
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>By email: info@esng.one</li>
          <li>ESNG One LLC, 8735 Dunwoody Place Ste R, Atlanta, GA, 30350</li>
        </ul>
      </section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          1. Introduction
        </h3>
        <p>
          This Privacy Policy describes Our policies and procedures on the collection, use
          and disclosure of Your information when You use the Service and tells You about
          Your privacy rights and how the law protects You.
        </p>
        <p className="mt-2">
          We use Your Personal data to provide and improve the Service. By using the Service,
          You agree to the collection and use of information in accordance with this Privacy Policy.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          2. Interpretation and Definitions
        </h3>
        <p>
          The words of which the initial letter is capitalized have meanings defined under
          the following conditions. The following definitions shall have the same meaning
          regardless of whether they appear in singular or in plural.
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>
            <strong>Account</strong> means a unique account created for You to access our
            Service or parts of our Service.
          </li>
          <li>
            <strong>Company</strong> (referred to as either &quot;the Company&quot;, &quot;We&quot;,
            &quot;Us&quot; or &quot;Our&quot; in this Agreement) refers to ESNG One LLC, 8735
            Dunwoody Place Ste R, Atlanta, GA, 30350.
          </li>
          <li>
            <strong>Cookies</strong> are small files that are placed on Your computer, mobile
            device or any other device by a website, containing the details of Your browsing
            history on that website among its many uses.
          </li>
          <li>
            <strong>Country</strong> refers to: Georgia, United States
          </li>
          <li>
            <strong>Personal Data</strong> is any information that relates to an identified
            or identifiable individual.
          </li>
          <li>
            <strong>Service</strong> refers to the Website and all related applications.
          </li>
          <li>
            <strong>Usage Data</strong> refers to data collected automatically, either generated
            by the use of the Service or from the Service infrastructure itself.
          </li>
          <li>
            <strong>You</strong> means the individual accessing or using the Service, or the
            company, or other legal entity on behalf of which such individual is accessing or
            using the Service, as applicable.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          3. Types of Data Collected
        </h3>
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Personal Data</h4>
        <p>
          While using Our Service, We may ask You to provide Us with certain personally
          identifiable information that can be used to contact or identify You. Personally
          identifiable information may include, but is not limited to:
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Email address</li>
          <li>First name and last name</li>
          <li>Phone number</li>
          <li>Usage Data</li>
        </ul>

        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 mt-4">Usage Data</h4>
        <p>
          Usage Data is collected automatically when using the Service. Usage Data may include
          information such as Your Device&apos;s Internet Protocol address (e.g. IP address),
          browser type, browser version, the pages of our Service that You visit, the time and
          date of Your visit, the time spent on those pages, unique device identifiers and other
          diagnostic data.
        </p>
        <p className="mt-2">
          When You access the Service by or through a mobile device, We may collect certain
          information automatically, including, but not limited to, the type of mobile device
          You use, Your mobile device unique ID, the IP address of Your mobile device, Your
          mobile operating system, the type of mobile Internet browser You use, unique device
          identifiers and other diagnostic data.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          4. Tracking Technologies and Cookies
        </h3>
        <p>
          We use Cookies and similar tracking technologies to track the activity on Our Service
          and store certain information. Tracking technologies used are beacons, tags, and scripts
          to collect and track information and to improve and analyze Our Service.
        </p>
        <p className="mt-2">
          Cookies can be &quot;Persistent&quot; or &quot;Session&quot; Cookies. Persistent Cookies
          remain on Your personal computer or mobile device when You go offline, while Session
          Cookies are deleted as soon as You close Your web browser.
        </p>
        <p className="mt-2">We use both Session and Persistent Cookies for the following purposes:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>
            <strong>Necessary / Essential Cookies:</strong> These Cookies are essential to provide
            You with services available through the Website and to enable You to use some of its
            features. They help to authenticate users and prevent fraudulent use of user accounts.
          </li>
          <li>
            <strong>Cookies Policy / Notice Acceptance Cookies:</strong> These Cookies identify if
            users have accepted the use of cookies on the Website.
          </li>
          <li>
            <strong>Functionality Cookies:</strong> These Cookies allow us to remember choices You
            make when You use the Website, such as remembering your login details or language
            preference.
          </li>
        </ul>
        <p className="mt-2">
          You can instruct Your browser to refuse all Cookies or to indicate when a Cookie is
          being sent. However, if You do not accept Cookies, You may not be able to use some
          parts of our Service.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          5. Use of Your Personal Data
        </h3>
        <p>The Company may use Personal Data for the following purposes:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>
            <strong>To provide and maintain our Service</strong>, including to monitor the usage
            of our Service.
          </li>
          <li>
            <strong>To manage Your Account:</strong> to manage Your registration as a user of the
            Service. The Personal Data You provide can give You access to different functionalities
            of the Service that are available to You as a registered user.
          </li>
          <li>
            <strong>For the performance of a contract:</strong> the development, compliance and
            undertaking of the purchase contract for the products, items or services You have
            purchased or of any other contract with Us through the Service.
          </li>
          <li>
            <strong>To contact You:</strong> To contact You by email, telephone calls, SMS, or
            other equivalent forms of electronic communication regarding updates or informative
            communications related to the functionalities, products or contracted services.
          </li>
          <li>
            <strong>To manage Your requests:</strong> To attend and manage Your requests to Us.
          </li>
          <li>
            <strong>For business transfers:</strong> We may use Your information to evaluate or
            conduct a merger, divestiture, restructuring, reorganization, dissolution, or other
            sale or transfer of some or all of Our assets.
          </li>
          <li>
            <strong>For other purposes:</strong> We may use Your information for other purposes,
            such as data analysis, identifying usage trends, determining the effectiveness of our
            promotional campaigns and to evaluate and improve our Service, products, services,
            marketing and your experience.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          6. Sharing Your Personal Information
        </h3>
        <p>We do not sell your personal information. We may share Your personal information in the following situations:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>
            <strong>With Service Providers:</strong> We may share Your personal information with
            Service Providers to monitor and analyze the use of our Service, to contact You.
          </li>
          <li>
            <strong>For business transfers:</strong> We may share or transfer Your personal
            information in connection with, or during negotiations of, any merger, sale of Company
            assets, financing, or acquisition of all or a portion of Our business to another company.
          </li>
          <li>
            <strong>With Affiliates:</strong> We may share Your information with Our affiliates, in
            which case we will require those affiliates to honor this Privacy Policy.
          </li>
          <li>
            <strong>With business partners:</strong> We may share Your information with Our business
            partners to offer You certain products, services or promotions.
          </li>
          <li>
            <strong>With Your consent:</strong> We may disclose Your personal information for any
            other purpose with Your consent.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          7. Retention of Your Personal Data
        </h3>
        <p>
          The Company will retain Your Personal Data only for as long as is necessary for the
          purposes set out in this Privacy Policy. We will retain and use Your Personal Data
          to the extent necessary to comply with our legal obligations, resolve disputes, and
          enforce our legal agreements and policies.
        </p>
        <p className="mt-2">
          The Company will also retain Usage Data for internal analysis purposes. Usage Data
          is generally retained for a shorter period of time, except when this data is used to
          strengthen the security or to improve the functionality of Our Service, or We are
          legally obligated to retain this data for longer time periods.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          8. Transfer of Your Personal Data
        </h3>
        <p>
          Your information, including Personal Data, is processed at the Company&apos;s operating
          offices and in any other places where the parties involved in the processing are located.
          It means that this information may be transferred to — and maintained on — computers
          located outside of Your state, province, country or other governmental jurisdiction
          where the data protection laws may differ than those from Your jurisdiction.
        </p>
        <p className="mt-2">
          Your consent to this Privacy Policy followed by Your submission of such information
          represents Your agreement to that transfer.
        </p>
        <p className="mt-2">
          The Company will take all steps reasonably necessary to ensure that Your data is
          treated securely and in accordance with this Privacy Policy and no transfer of Your
          Personal Data will take place to an organization or a country unless there are adequate
          controls in place including the security of Your data and other personal information.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          9. Delete Your Personal Data
        </h3>
        <p>
          You have the right to delete or request that We assist in deleting the Personal Data
          that We have collected about You.
        </p>
        <p className="mt-2">
          Our Service may give You the ability to delete certain information about You from
          within the Service. You may update, amend, or delete Your information at any time
          by signing in to Your Account, if you have one, and visiting the account settings
          section that allows you to manage Your personal information. You may also contact
          Us to request access to, correct, or delete any personal information that You have
          provided to Us.
        </p>
        <p className="mt-2">
          Please note, however, that We may need to retain certain information when we have
          a legal obligation or lawful basis to do so.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          10. Disclosure of Your Personal Data
        </h3>
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Business Transactions</h4>
        <p>
          If the Company is involved in a merger, acquisition or asset sale, Your Personal Data
          may be transferred. We will provide notice before Your Personal Data is transferred
          and becomes subject to a different Privacy Policy.
        </p>

        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 mt-4">Law Enforcement</h4>
        <p>
          Under certain circumstances, the Company may be required to disclose Your Personal
          Data if required to do so by law or in response to valid requests by public authorities
          (e.g. a court or a government agency).
        </p>

        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 mt-4">Other Legal Requirements</h4>
        <p>The Company may disclose Your Personal Data in the good faith belief that such action is necessary to:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Comply with a legal obligation</li>
          <li>Protect and defend the rights or property of the Company</li>
          <li>Prevent or investigate possible wrongdoing in connection with the Service</li>
          <li>Protect the personal safety of Users of the Service or the public</li>
          <li>Protect against legal liability</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          11. Security of Your Personal Data
        </h3>
        <p>
          The security of Your Personal Data is important to Us, but remember that no method
          of transmission over the Internet, or method of electronic storage is 100% secure.
          While We strive to use commercially acceptable means to protect Your Personal Data,
          We cannot guarantee its absolute security.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          12. Children&apos;s Privacy
        </h3>
        <p>
          Our Service does not address anyone under the age of 13. We do not knowingly collect
          personally identifiable information from anyone under the age of 13. If You are a
          parent or guardian and You are aware that Your child has provided Us with Personal
          Data, please contact Us. If We become aware that We have collected Personal Data
          from anyone under the age of 13 without verification of parental consent, We take
          steps to remove that information from Our servers.
        </p>
        <p className="mt-2">
          If We need to rely on consent as a legal basis for processing Your information and
          Your country requires consent from a parent, We may require Your parent&apos;s consent
          before We collect and use that information.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          13. Links to Other Websites
        </h3>
        <p>
          Our Service may contain links to other websites that are not operated by Us. If You
          click on a third party link, You will be directed to that third party&apos;s site.
          We strongly advise You to review the Privacy Policy of every site You visit.
        </p>
        <p className="mt-2">
          We have no control over and assume no responsibility for the content, privacy policies
          or practices of any third party sites or services.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          14. Google Analytics Usage
        </h3>
        <p>
          We use Google Analytics, a web analytics service provided by Google Inc., to gather
          information about how visitors engage with our website. Google Analytics uses cookies
          to collect standard internet log information and visitor behavior information in an
          anonymous form. The information generated by the cookie about your use of the website
          (including your IP address) is transmitted to Google.
        </p>
        <p className="mt-2">
          We use this data solely for the purpose of improving the user experience and optimizing
          our website. Google Analytics does not identify individual users or associate your IP
          address with any other data held by Google.
        </p>
        <p className="mt-2">
          By using this website, you consent to the processing of data about you by Google in
          the manner and for the purposes set out above.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          15. General Data Protection Regulation (GDPR) Compliance
        </h3>
        <p>
          In compliance with the General Data Protection Regulation (GDPR), we are committed
          to ensuring the security and protection of the personal information that we process.
          We have implemented appropriate technical and organizational measures to meet the
          requirements of the GDPR and to safeguard the rights and freedoms of individuals.
        </p>

        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 mt-4">Lawful Basis for Processing</h4>
        <p>
          We process personal data based on one or more lawful bases as defined in Article 6
          of the GDPR. These lawful bases include the necessity of processing for the performance
          of a contract, compliance with a legal obligation, protection of vital interests,
          consent, the performance of a task carried out in the public interest, and legitimate
          interests pursued by the data controller or a third party.
        </p>

        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 mt-4">Data Minimization</h4>
        <p>
          We only collect and process personal data that is necessary for the purposes for
          which it was collected. We do not retain personal information for longer than is necessary.
        </p>

        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 mt-4">Rights of Data Subjects</h4>
        <p>
          Under the GDPR, individuals have the right to access, rectify, erase, restrict
          processing, object to processing, and data portability. If you wish to exercise
          any of these rights, please contact us at info@esng.one
        </p>

        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 mt-4">Data Security</h4>
        <p>
          We have implemented appropriate technical and organizational measures to ensure the
          security of personal data. This includes protection against unauthorized or unlawful
          processing and against accidental loss, destruction, or damage.
        </p>

        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 mt-4">Data Transfers</h4>
        <p>
          If we transfer personal data to third parties or outside the European Economic Area
          (EEA), we ensure that adequate safeguards are in place to protect the data, as required
          by the GDPR.
        </p>

        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 mt-4">Data Breach Notification</h4>
        <p>
          In the event of a data breach that is likely to result in a high risk to the rights
          and freedoms of individuals, we will notify the relevant supervisory authority and
          affected data subjects without undue delay, as required by the GDPR.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          16. Changes to This Privacy Policy
        </h3>
        <p>
          We may update Our Privacy Policy from time to time. We will notify You of any changes
          by posting the new Privacy Policy on this page.
        </p>
        <p className="mt-2">
          We will let You know via email and/or a prominent notice on Our Service, prior to
          the change becoming effective and update the &quot;Last updated&quot; date at the top
          of this Privacy Policy.
        </p>
        <p className="mt-2">
          You are advised to review this Privacy Policy periodically for any changes. Changes
          to this Privacy Policy are effective when they are posted on this page.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          17. Contact Us
        </h3>
        <p>If you have any questions about this Privacy Policy, You can contact us:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>By email: info@esng.one</li>
          <li>ESNG One LLC, 8735 Dunwoody Place Ste R, Atlanta, GA, 30350</li>
        </ul>
      </section>
    </div>
  );
}
