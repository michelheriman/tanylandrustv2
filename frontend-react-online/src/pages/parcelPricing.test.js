import test from 'node:test'
import assert from 'node:assert/strict'
import {
  estimateParcelTotal,
  formatAreaSquareMeters,
  formatExactPricingAmount,
  hectaresToSquareMeters,
  isPositiveAreaSquareMeters,
  isPositivePricingDecimal,
  squareMetersToHectares,
} from './parcelPricing.js'

test('converts the displayed square metres to stored hectares and back', () => {
  assert.equal(squareMetersToHectares('10000'), '1')
  assert.equal(hectaresToSquareMeters('1'), '10000')
  assert.equal(formatAreaSquareMeters('1'), '10,000 m²')
  assert.equal(formatAreaSquareMeters('1', 'fr-FR'), '10\u202f000 m²')
})

test('estimates total price from square metres and price per square metre', () => {
  assert.equal(estimateParcelTotal('10000', '12.345', 'USD'), '123450.00')
  assert.equal(estimateParcelTotal('2', '0.5', 'UGX'), '1')
  assert.equal(estimateParcelTotal('1', '0.49', 'UGX'), null)
  assert.equal(isPositiveAreaSquareMeters('10000'), true)
  assert.equal(isPositiveAreaSquareMeters('1.00001'), false)
})

test('returns no estimate for missing, invalid or unsupported inputs', () => {
  assert.equal(estimateParcelTotal('', '2', 'USD'), null)
  assert.equal(estimateParcelTotal('1', 'Infinity', 'USD'), null)
  assert.equal(estimateParcelTotal('1', '2', 'XYZ'), null)
  assert.equal(isPositivePricingDecimal('0'), false)
  assert.equal(isPositivePricingDecimal('1.000000001'), false)
  assert.equal(isPositivePricingDecimal('0.00000001'), true)
})

test('formats Marketplace prices without converting large decimals through imprecise Number values', () => {
  assert.equal(
    formatExactPricingAmount('12345678901234567890.25', 'USD'),
    '12,345,678,901,234,567,890.25',
  )
  assert.equal(formatExactPricingAmount('0.12345678', 'USD'), '0.12345678')
  assert.equal(formatExactPricingAmount('1234', 'UGX'), '1,234')
  assert.equal(formatExactPricingAmount('1234.50', 'OLD'), '1,234.5')
})
