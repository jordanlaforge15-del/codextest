import { describe, expect, it } from 'vitest';
import { extractMetadata } from '../src/services/metadata-extraction-service.js';

describe('extractMetadata', () => {
  it('extracts normalized metadata from a typical ecommerce capture', () => {
    const result = extractMetadata(
      {
        pageUrl: 'https://www.patagonia.ca/product/mens-better-sweater-fleece-vest/25882.html',
        imageUrl:
          'https://www.patagonia.ca/dw/image/v2/BDJB_PRD/on/demandware.static/-/Sites-patagonia-master/default/dw3e340922/images/hi-res/25882_GRBN.jpg',
        pageTitle: "Patagonia Men's Better Sweater Fleece Vest | Patagonia",
        altText: "Patagonia Men's Better Sweater Fleece Vest",
        surroundingText: 'Warm fleece vest in New Navy. CA$149.00. Sizes S, M, L.',
        rawPayloadJson: {
          product: {
            title: "Patagonia Men's Better Sweater Fleece Vest",
            brand: 'Patagonia',
            price: 'CA$149.00',
            currency: 'CAD',
            color: 'New Navy',
            sku: '25882-GRBN',
            sizes: ['S', 'M', 'L']
          }
        }
      },
      { includeDeepSignals: true }
    );

    expect(result.title).toBe("Patagonia Men's Better Sweater Fleece Vest");
    expect(result.merchant).toBe('Patagonia');
    expect(result.brand).toBe('Patagonia');
    expect(result.slotType).toBe('vest');
    expect(result.price).toBe('149.00');
    expect(result.currency).toBe('CAD');
    expect(result.metadataJson.extraction).toMatchObject({
      derived: {
        colorName: 'New Navy',
        sizeOptions: ['S', 'M', 'L'],
        sku: '25882-GRBN'
      }
    });
  });

  it('handles minimal captures without throwing and derives merchant and slot type', () => {
    const result = extractMetadata({
      pageUrl: 'https://shop.example-store.com/products/blue-running-jacket',
      imageUrl: 'https://cdn.example-store.com/images/blue-jacket.jpg',
      pageTitle: 'Blue Running Jacket | Example Store'
    });

    expect(result.title).toBe('Blue Running Jacket');
    expect(result.merchant).toBe('Example Store');
    expect(result.brand).toBeNull();
    expect(result.slotType).toBe('jacket');
    expect(result.price).toBeNull();
    expect(result.metadataJson.extraction).toMatchObject({
      mode: 'sync_capture'
    });
  });

  it('degrades gracefully on malformed or sparse inputs', () => {
    const result = extractMetadata({
      pageUrl: 'not-a-valid-url',
      imageUrl: null,
      pageTitle: 'Home',
      altText: 'Image',
      surroundingText: null,
      rawPayloadJson: {
        weird: [{ nested: true }, null, { value: '' }]
      }
    });

    expect(result.title).toBeNull();
    expect(result.merchant).toBeNull();
    expect(result.brand).toBeNull();
    expect(result.slotType).toBeNull();
    expect(result.price).toBeNull();
    expect(result.currency).toBeNull();
    expect(result.metadataJson.extraction).toBeDefined();
  });
});
