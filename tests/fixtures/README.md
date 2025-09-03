# Test Fixtures

This directory contains test fixtures for Playwright E2E tests.

## Files

- `sample-ticket.pdf` - Sample train ticket PDF for upload testing (not included in git)
- Add actual PDF files here for testing file upload functionality

## Usage

Test files should be placed in this directory and referenced in tests using:

```typescript
import path from 'path';

const testPDFPath = path.join(process.cwd(), 'tests/fixtures/sample-ticket.pdf');
await fileInput.setInputFiles([testPDFPath]);
```

## Notes

- PDF files are not committed to git due to size
- Tests are designed to work even when fixture files are missing
- Create your own sample PDF files for comprehensive upload testing