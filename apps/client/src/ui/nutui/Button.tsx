import React from 'react';

import { Button as NutButton } from '@nutui/nutui-react-taro';

export type AppButtonVariant = 'primary' | 'ghost' | 'danger' | 'default';

export type AppButtonProps = React.ComponentProps<typeof NutButton> & {
  variant?: AppButtonVariant;
};

function resolveNutButtonProps(
  variant: AppButtonVariant,
  props: React.ComponentProps<typeof NutButton>,
): Pick<React.ComponentProps<typeof NutButton>, 'type' | 'fill' | 'shape' | 'block'> {
  const type = props.type;
  const fill = props.fill;
  const shape = props.shape;
  const block = props.block;
  const size = props.size;

  return {
    type:
      type ??
      (variant === 'primary'
        ? 'primary'
        : variant === 'ghost'
          ? 'primary'
          : variant === 'danger'
            ? 'danger'
            : 'default'),
    fill:
      fill ??
      (variant === 'primary'
        ? 'solid'
        : variant === 'ghost'
          ? 'outline'
          : variant === 'danger'
            ? 'outline'
            : 'solid'),
    shape: shape ?? 'square',
    block: block ?? (size === 'small' ? false : true),
  };
}

export function Button({ variant = 'primary', ...rest }: AppButtonProps) {
  const resolved = resolveNutButtonProps(variant, rest);
  return <NutButton {...rest} {...resolved} />;
}
