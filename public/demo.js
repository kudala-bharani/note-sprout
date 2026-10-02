export const SAMPLE_NOTES = `Data structures: a quick revision

A stack follows Last In, First Out (LIFO): the most recently added item is the first one removed. Pushing adds an item to the top; popping removes the top item. A stack is useful for undo operations and function calls.

A queue follows First In, First Out (FIFO): the earliest added item is the first one removed. Enqueue adds an item to the back; dequeue removes an item from the front. Queues are useful for scheduling tasks.

Binary search works on a sorted collection. It compares the target with the middle element, then repeatedly searches the half that could contain the target. Binary search has O(log n) time complexity.

A hash table stores key-value pairs. A hash function maps each key to an index. A collision happens when different keys map to the same index. With a good hash function, lookup is O(1) on average.

A linked list consists of nodes that store data and references to other nodes. Unlike an array, a linked list does not need a contiguous block of memory.`;

export const DEMO_QUIZ = {
  title: "A few computer science roots",
  model: "Handwritten sample",
  questions: [
    {
      question: "What does Last In, First Out mean for the order in which a stack removes items?",
      evidence: "A stack follows Last In, First Out (LIFO): the most recently added item is the first one removed."
    },
    {
      question: "What must be true of a collection before you can use binary search on it?",
      evidence: "Binary search works on a sorted collection."
    },
    {
      question: "In a hash table, what is a collision?",
      evidence: "A collision happens when different keys map to the same index."
    }
  ]
};
