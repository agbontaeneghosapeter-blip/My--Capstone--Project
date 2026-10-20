// First-in-first-out queue built as a singly linked list.
// Every operation is O(1): we keep a pointer to both ends, so nothing is
// ever shifted or scanned (unlike array.shift(), which is O(n)).
export class Queue {
  #head = null; // next to leave
  #tail = null; // last to arrive
  #size = 0;

  enqueue(value) {
    const node = { value, next: null };
    if (this.#tail === null) {
      this.#head = node;
    } else {
      this.#tail.next = node;
    }
    this.#tail = node;
    this.#size++;
  }

  dequeue() {
    if (this.#head === null) return undefined;
    const { value } = this.#head;
    this.#head = this.#head.next;
    if (this.#head === null) this.#tail = null;
    this.#size--;
    return value;
  }

  peek() {
    return this.#head === null ? undefined : this.#head.value;
  }

  get size() {
    return this.#size;
  }
}
