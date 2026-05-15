export const INJECTION_USER = [
  /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|directives?|prompts?)\b/i,
  /\bdisregard\s+(all\s+)?(previous|prior|above)\b/i,
  /\bforget\s+(everything|all|previous)\b/i,
  /\bact\s+as\s+(if\s+you\s+are|a\s+|an\s+)/i,
  /\bpretend\s+(you\s+are|to\s+be|that)/i,
  /\bsystem\s*[:.]?\s*you\s+are\s+now\b/i,
  /\byou\s+are\s+now\s+(a\s+|an\s+|going\s+to)/i,
  /\breveal\s+(your\s+)?(system\s+)?(prompt|instructions)\b/i,
  /\boverride\s+(your|the)\s+(instructions|rules|programming)\b/i,
  /\bjailbreak\b/i, /\bDAN\s+mode\b/i, /\bdeveloper\s+mode\b/i,
  /<\s*\|\s*(im_start|im_end|system|user|assistant)\s*\|\s*>/i,
];

export const INJECTION_EVIDENCE = [
  ...INJECTION_USER,
  /<!--[\s\S]*?(instruction|prompt|directive|system)[\s\S]*?-->/i,
  /\bset\s+(?:the\s+)?(?:trust\s+)?score\s+to\s+\d/i,
  /\bgive\s+(?:this|the)\s+(?:contractor|company|entity)\s+a\s+(?:perfect|high|low|max)\s+score/i,
  /\brate\s+(?:this|the)\s+(?:contractor|company)\s+\d+/i,
  /\bmark\s+(?:this|the)\s+(?:contractor|company)\s+as\s+(?:verified|trusted|safe)/i,
  /\bclassify\s+as\s+(?:safe|trusted|verified|low.risk)/i,
  /\b(?:assistant|claude|gpt|model)[:,]?\s+(?:please|now|will|should)\s+/i,
  /<\s*script[\s>]/i, /<\s*iframe[\s>]/i, /javascript:\s*[a-z]/i,
];
