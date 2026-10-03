import type { Root } from 'hast';
import { toJsxRuntime, type Components } from 'hast-util-to-jsx-runtime';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { LinkIcon } from './icons';
import { Mermaid } from './mermaid';

function Anchor({ href = '', children, ...rest }: ComponentProps<'a'>) {
  if (href.startsWith('/') || href.startsWith('#')) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

function heading(Tag: 'h2' | 'h3' | 'h4') {
  return function Heading({ id, children, ...rest }: ComponentProps<'h2'>) {
    return (
      <Tag id={id} {...rest}>
        {children}
        {id && (
          <a className="heading-anchor" href={`#${id}`} aria-label="Link to this section">
            <LinkIcon />
          </a>
        )}
      </Tag>
    );
  };
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  return '';
}

const components = {
  a: Anchor,
  h2: heading('h2'),
  h3: heading('h3'),
  h4: heading('h4'),
  table: (props: ComponentProps<'table'>) => (
    <div className="table-wrap" tabIndex={0}>
      <table {...props} />
    </div>
  ),
  pre: (props: ComponentProps<'pre'>) => (
    <CodeBlock {...props}>
      <Pre>{props.children}</Pre>
    </CodeBlock>
  ),
  img: ({ alt = '', ...props }: ComponentProps<'img'>) => (
    // Source images are served as-is from public/source; width and height come from the file.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
  'mermaid-diagram': ({ children }: { children?: ReactNode }) => <Mermaid chart={textOf(children)} />,
} as unknown as Components;

export function Markdown({ tree }: { tree: Root }) {
  return toJsxRuntime(tree, { Fragment, jsx, jsxs, components, passKeys: true }) as ReactNode;
}
