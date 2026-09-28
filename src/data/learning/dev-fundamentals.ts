// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Sample Deck: Dev Fundamentals
// JavaScript, Git, HTTP and React essentials, mixing every card kind.
// Ids are stable, so restoring it never creates a duplicate and
// review progress survives content updates.
// ═══════════════════════════════════════════════════════════

import type { DeckInput } from '@/types/learning';

export const DEV_FUNDAMENTALS: DeckInput = {
  id: 'sample-dev-fundamentals',
  name: 'Dev Fundamentals',
  description: 'JavaScript, Git, HTTP and React essentials. A starter deck: edit it, extend it or delete it.',
  color: '#a78bfa',
  icon: '💻',
  isSample: true,
  topics: [
    {
      id: 'sample-dev-javascript',
      name: 'JavaScript',
      cards: [
        {
          id: 'sample-dev-js-typeof-null',
          kind: 'mcq',
          prompt: 'What does `typeof null` return?',
          options: ['"object"', '"null"', '"undefined"', '"number"'],
          answer: 0,
          explanation:
            'A quirk from the very first version of JavaScript that can never be fixed without breaking the web. Test for null with `value === null`.',
          difficulty: 'easy',
          tags: ['javascript'],
        },
        {
          id: 'sample-dev-js-falsy',
          kind: 'multi-select',
          prompt: 'Which of these values are falsy? Pick all that apply.',
          options: ['0', '"" (empty string)', 'null', 'NaN', '[] (empty array)', '"0"'],
          answers: [0, 1, 2, 3],
          explanation:
            'The falsy values are false, 0, -0, 0n, "", null, undefined and NaN. Everything else is truthy, including [], {} and the string "0".',
          difficulty: 'medium',
          tags: ['javascript'],
        },
        {
          id: 'sample-dev-js-reduce',
          kind: 'numeric',
          prompt: 'What does `[1, 2, 3].reduce((sum, n) => sum + n, 10)` return?',
          answer: 16,
          explanation: 'reduce starts from the initial value 10 and adds each element: 10 + 1 + 2 + 3 = 16.',
          difficulty: 'easy',
          tags: ['javascript', 'arrays'],
        },
        {
          id: 'sample-dev-js-closure',
          kind: 'flashcard',
          prompt: 'What is a closure?',
          back: 'A function bundled with the variables of the scope it was created in. It can still read and update them after the outer function has returned.',
          explanation: 'Example: `function counter() { let n = 0; return () => ++n; }` keeps `n` alive between calls.',
          difficulty: 'medium',
          tags: ['javascript', 'functions'],
        },
        {
          id: 'sample-dev-js-const',
          kind: 'mcq',
          prompt: 'Which declaration is block-scoped and cannot be reassigned?',
          options: ['const', 'let', 'var', 'function'],
          answer: 0,
          explanation:
            'let and const are block-scoped, and only const forbids reassignment (an object it holds can still be mutated). var is function-scoped and hoisted.',
          difficulty: 'easy',
          tags: ['javascript'],
        },
        {
          id: 'sample-dev-js-event-loop',
          kind: 'mcq',
          prompt:
            'What does this log?\n\nconsole.log(1);\nsetTimeout(() => console.log(2), 0);\nPromise.resolve().then(() => console.log(3));\nconsole.log(4);',
          options: ['1 4 3 2', '1 2 3 4', '1 4 2 3', '1 3 4 2'],
          answer: 0,
          explanation:
            'Synchronous code runs first (1, 4). The microtask queue (promise callbacks: 3) is drained before the next macrotask (the timer: 2).',
          difficulty: 'hard',
          tags: ['javascript', 'async'],
        },
      ],
    },
    {
      id: 'sample-dev-git',
      name: 'Git',
      cards: [
        {
          id: 'sample-dev-git-add',
          kind: 'mcq',
          prompt: 'Which command stages changes for the next commit?',
          options: ['git add', 'git commit', 'git push', 'git fetch'],
          answer: 0,
          explanation: 'git add copies changes into the staging area (the index); git commit records what is staged.',
          difficulty: 'easy',
          tags: ['git'],
        },
        {
          id: 'sample-dev-git-pull',
          kind: 'mcq',
          prompt: 'What does `git pull` do?',
          options: [
            'Fetches from the remote, then merges (or rebases) into the current branch',
            'Downloads remote commits without touching your branch',
            'Uploads your local commits to the remote',
            'Discards your uncommitted changes',
          ],
          answer: 0,
          explanation: 'pull = fetch + integrate. git fetch alone only updates remote-tracking branches such as origin/main.',
          difficulty: 'medium',
          tags: ['git'],
        },
        {
          id: 'sample-dev-git-merge-rebase',
          kind: 'flashcard',
          prompt: 'git merge vs git rebase?',
          back: 'Merge joins two histories with a merge commit and keeps both lines as they happened. Rebase replays your commits on top of another branch for a linear history, creating new commits in the process.',
          explanation: 'Never rebase commits others have already pulled: their history would no longer match yours.',
          difficulty: 'medium',
          tags: ['git'],
        },
        {
          id: 'sample-dev-git-rewrite',
          kind: 'multi-select',
          prompt: 'Which of these rewrite existing history? Pick all that apply.',
          options: ['git rebase', 'git commit --amend', 'git reset --hard HEAD~1', 'git revert <commit>', 'git log'],
          answers: [0, 1, 2],
          explanation:
            'rebase and amend create replacement commits, and reset moves the branch pointer back. revert only adds a new commit that undoes an old one, so it is safe on shared branches.',
          difficulty: 'hard',
          tags: ['git'],
        },
        {
          id: 'sample-dev-git-sha',
          kind: 'numeric',
          prompt: 'How many hexadecimal characters are in a full Git commit hash (SHA-1)?',
          answer: 40,
          unit: 'chars',
          explanation:
            'SHA-1 is 160 bits, which is 40 hex digits. Git accepts any unique prefix, usually 7 characters, as a short hash.',
          difficulty: 'medium',
          tags: ['git'],
        },
      ],
    },
    {
      id: 'sample-dev-http',
      name: 'HTTP',
      cards: [
        {
          id: 'sample-dev-http-404',
          kind: 'numeric',
          prompt: 'Which HTTP status code means Not Found?',
          answer: 404,
          explanation: '2xx means success, 3xx redirection, 4xx a client error and 5xx a server error.',
          difficulty: 'easy',
          tags: ['http'],
        },
        {
          id: 'sample-dev-http-401-403',
          kind: 'mcq',
          prompt: 'A request arrives without valid credentials. Which status code fits?',
          options: ['401 Unauthorized', '403 Forbidden', '404 Not Found', '500 Internal Server Error'],
          answer: 0,
          explanation: '401 means "who are you?": authenticate first. 403 means "I know who you are, and you may not".',
          difficulty: 'medium',
          tags: ['http', 'auth'],
        },
        {
          id: 'sample-dev-http-idempotent',
          kind: 'multi-select',
          prompt: 'Which HTTP methods are idempotent? Pick all that apply.',
          options: ['GET', 'PUT', 'DELETE', 'POST', 'PATCH'],
          answers: [0, 1, 2],
          explanation:
            'Sending an idempotent request many times leaves the server in the same state as sending it once. POST usually creates something new each time, and PATCH is not guaranteed to be idempotent.',
          difficulty: 'hard',
          tags: ['http'],
        },
        {
          id: 'sample-dev-http-https-port',
          kind: 'numeric',
          prompt: 'Which TCP port does HTTPS use by default?',
          answer: 443,
          explanation: 'HTTP defaults to port 80 and HTTPS to 443.',
          difficulty: 'easy',
          tags: ['http', 'networking'],
        },
        {
          id: 'sample-dev-http-cors',
          kind: 'flashcard',
          prompt: 'What does CORS control?',
          back: 'Whether a web page may read responses from another origin. The browser allows it only when the server answers with Access-Control-Allow-Origin (and related) headers; non-simple requests are checked first with an OPTIONS preflight.',
          explanation: 'CORS is enforced by browsers. It does not stop curl or other servers from calling an API.',
          difficulty: 'hard',
          tags: ['http', 'security'],
        },
      ],
    },
    {
      id: 'sample-dev-react',
      name: 'React',
      cards: [
        {
          id: 'sample-dev-react-keys',
          kind: 'mcq',
          prompt: 'Why does React need a stable `key` on list items?',
          options: [
            'To match items between renders, so each keeps its own state and DOM node',
            'To style the items',
            'To make the items focusable with Tab',
            'To sort the list',
          ],
          answer: 0,
          explanation:
            'Keys tell React which item is which. Array indexes break when items are inserted, removed or reordered: state sticks to the wrong row.',
          difficulty: 'medium',
          tags: ['react'],
        },
        {
          id: 'sample-dev-react-hooks-rules',
          kind: 'multi-select',
          prompt: 'Which of these are rules of hooks? Pick all that apply.',
          options: [
            'Call hooks only at the top level of a component or custom hook',
            'Never call hooks inside loops, conditions or nested functions',
            'Start custom hook names with "use"',
            'Hooks may be called from any plain helper function',
          ],
          answers: [0, 1, 2],
          explanation: 'React identifies each hook by its call order, so that order must be the same on every render.',
          difficulty: 'medium',
          tags: ['react', 'hooks'],
        },
        {
          id: 'sample-dev-react-effect-deps',
          kind: 'flashcard',
          prompt: 'What does the dependency array of `useEffect` do?',
          back: 'It lists the reactive values the effect reads. React re-runs the effect after a render only if one of them changed; [] runs it once after mount. The cleanup runs before each re-run and on unmount.',
          difficulty: 'medium',
          tags: ['react', 'hooks'],
        },
        {
          id: 'sample-dev-react-batched-state',
          kind: 'numeric',
          prompt:
            '`count` is 0. A click handler calls `setCount(count + 1)` three times. What is `count` after the re-render?',
          answer: 1,
          explanation:
            'Every call reads the same `count` from that render (0), so each one sets 1. The updater form `setCount(c => c + 1)` would give 3.',
          difficulty: 'hard',
          tags: ['react', 'state'],
        },
        {
          id: 'sample-dev-react-usememo',
          kind: 'mcq',
          prompt: 'Which hook caches a computed value between renders?',
          options: ['useMemo', 'useCallback', 'useRef', 'useEffect'],
          answer: 0,
          explanation:
            'useMemo caches a value until its dependencies change, useCallback does the same for a function, and useRef holds a mutable value that does not trigger renders.',
          difficulty: 'easy',
          tags: ['react', 'hooks'],
        },
      ],
    },
  ],
};
