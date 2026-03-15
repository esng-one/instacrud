import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Multi-Tenant Architecture',
    description: (
      <>
        Built for SaaS platforms and enterprise applications. Each tenant runs on
        isolated database infrastructure to ensure strict data boundaries and secure
        deployments.
      </>
    ),
  },
  {
    title: 'Production-Grade Foundation',
    description: (
      <>
        Authentication, authorization, audit logging, admin UI and storage
        abstraction — everything required to launch real products with confidence.
      </>
    ),
  },
  {
    title: 'Designed for Developers',
    description: (
      <>
        Clear structure, clean code principles and extensibility. Swap storage
        engines, authentication strategies or UI clients without rewriting the core.
      </>
    ),
  },
];

function Feature({title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p style={{opacity: 0.9, fontSize: '0.92rem', lineHeight: '1.5rem'}}>
          {description}
        </p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features} style={{padding: '4rem 0'}}>
      <div className="container">
        <div
          className="text--center"
          style={{marginBottom: '3rem'}}
        >
          <Heading as="h2" style={{fontSize: '2.2rem'}}>
            Why InstaCRUD Exists
          </Heading>
          <p style={{opacity: 0.8, marginTop: '0.5rem'}}>
            A clean and dependable architecture for building scalable products.
          </p>
        </div>

        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
