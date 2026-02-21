import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const typographyGuardPlugin = {
  rules: {
    'no-tailwind-arbitrary-text-size': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Warn when Tailwind arbitrary font-size utilities are used',
        },
      },
      create(context) {
        const arbitraryTextSizePattern = /\btext-\[(?:\d|\.)/

        const checkValue = (value, node) => {
          if (typeof value !== 'string') return
          if (arbitraryTextSizePattern.test(value)) {
            context.report({
              node,
              message:
                'Avoid arbitrary Tailwind text sizes (text-[...]). Use Text/Heading primitives and typography tokens.',
            })
          }
        }

        return {
          JSXAttribute(node) {
            if (node.name?.name !== 'className' || !node.value) return

            if (node.value.type === 'Literal') {
              checkValue(node.value.value, node.value)
              return
            }

            if (node.value.type !== 'JSXExpressionContainer') return
            const expression = node.value.expression

            if (expression.type === 'Literal') {
              checkValue(expression.value, expression)
              return
            }

            if (expression.type === 'TemplateLiteral') {
              expression.quasis.forEach((quasi) => checkValue(quasi.value.raw, quasi))
            }
          },
        }
      },
    },
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      typographyGuard: typographyGuardPlugin,
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-hooks/set-state-in-effect': 'off',
      'typographyGuard/no-tailwind-arbitrary-text-size': 'warn',
    },
  },
])
