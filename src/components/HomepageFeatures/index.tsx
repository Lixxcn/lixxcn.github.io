import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: '🚀 技术探索',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        在代码的海洋中航行，探索技术的无限可能。
        每一行代码都是通往未来的桥梁，每一个项目都是梦想的具象化。
      </>
    ),
  },
  {
    title: '📚 知识花园',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        用心栽培知识的种子，让经验在时间中发芽成长。
        在这片数字花园里，每一份文档都是智慧的结晶。
      </>
    ),
  },
  {
    title: '🌟 生活诗篇',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        技术之外，还有诗和远方。记录生活的美好瞬间，
        用文字描绘心中的风景，让每一天都闪闪发光。
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
