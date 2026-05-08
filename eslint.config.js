import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  firebaseRulesPlugin.configs['flat/recommended'],
  {
    files: ['firestore.rules', 'DRAFT_firestore.rules'],
    rules: {
      '@firebase/security-rules/indent': 'off',
    }
  }
];
