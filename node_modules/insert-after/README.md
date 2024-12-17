# insert-after

> Insert node after

## Install

```sh
npm install --save insert-after
```

## Usage

```js
import insertAfter from 'insert-after';

const node = document.createElement('div');
insertAfter(node, document.querySelector('.ref'));
```

## API

### insertAfter(node, ref)

#### node

Type: `element`

Node for insert.

#### ref

Type: `element`

Reference node, after which `node` will be inserted.

## License

MIT
