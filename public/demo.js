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
      question: "You push A, then B, then C onto a stack. Which item comes out with the first pop?",
      options: ["A — the first item added", "B — the middle item", "C — the last item added", "All three items at once"],
      answerIndex: 2,
      explanation: "A stack removes the most recently added item first. Since C was pushed last, it sits at the top and is popped first.",
      evidence: "A stack follows Last In, First Out (LIFO): the most recently added item is the first one removed."
    },
    {
      question: "What must be true of a collection before you can use binary search on it?",
      options: ["It contains only numbers", "It is sorted", "It contains no duplicates", "It has an even number of elements"],
      answerIndex: 1,
      explanation: "Binary search uses the ordering to decide which half could contain the target. Without a sorted collection, that decision is not reliable.",
      evidence: "Binary search works on a sorted collection."
    },
    {
      question: "In a hash table, what is a collision?",
      options: ["A key is removed from the table", "A collection runs out of memory", "A lookup takes constant time", "Different keys map to the same index"],
      answerIndex: 3,
      explanation: "A hash function chooses an index for each key. When two different keys land at the same index, the table must handle a collision.",
      evidence: "A collision happens when different keys map to the same index."
    }
  ]
};
