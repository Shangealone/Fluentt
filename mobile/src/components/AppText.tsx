import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTranslation } from 'react-i18next';

export interface AppTextProps extends TextProps {
  i18nKey?: string;
  values?: Record<string, unknown>;
  children?: React.ReactNode;
}

export const AppText: React.FC<AppTextProps> = ({
  i18nKey,
  values,
  children,
  style,
  ...rest
}) => {
  const { t } = useTranslation();

  const content = i18nKey ? t(i18nKey, values) : children;

  return (
    <Text style={style} {...rest}>
      {content}
    </Text>
  );
};
