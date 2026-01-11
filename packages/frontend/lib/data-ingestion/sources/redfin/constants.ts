/**
 * Redfin Data Center - Constants and Configuration
 */

import type { RedfinDataset } from './types'

// Redfin Data Center base URL
export const REDFIN_DATA_CENTER_URL = 'https://www.redfin.com/news/data-center/'

// Redfin dataset categories and keywords for discovery
export const REDFIN_DATASET_CATEGORIES = {
    // Sales/Market Data
    sales: {
        keywords: ['median sale price', 'sale price', 'homes sold', 'sales', 'sold'],
        metricPrefix: 'sales_'
    },
    // Rental Data
    rental: {
        keywords: ['rent', 'rental', 'median rent', 'rent price', 'rental price', 'zori'],
        metricPrefix: 'rental_'
    },
    // Investor Data
    investor: {
        keywords: ['investor', 'flip', 'flipping', 'cash buyer', 'institutional', 'buy-to-rent', 'btor'],
        metricPrefix: 'investor_'
    },
    // Inventory Data
    inventory: {
        keywords: ['inventory', 'active listings', 'new listings', 'supply'],
        metricPrefix: 'inventory_'
    },
    // Market Activity
    activity: {
        keywords: ['days on market', 'dom', 'price cuts', 'price reduction', 'pending sales', 'off market'],
        metricPrefix: 'activity_'
    },
    // Price Metrics
    price: {
        keywords: ['price per square foot', 'price/sqft', 'median price', 'average price', 'list price'],
        metricPrefix: 'price_'
    },
    // Affordability
    affordability: {
        keywords: ['affordability', 'affordable', 'price-to-income', 'mortgage payment'],
        metricPrefix: 'affordability_'
    }
} as const

// Known Redfin datasets (will be expanded by discovery)
export const REDFIN_DATASETS: Record<string, RedfinDataset> = {
    // Sales Data
    median_sale_price: {
        description: 'Median Sale Price',
        category: 'sales',
        keywords: ['median', 'sale', 'price']
    },
    homes_sold: {
        description: 'Homes Sold',
        category: 'sales',
        keywords: ['homes', 'sold']
    },
    // Rental Data
    median_rent: {
        description: 'Median Rent',
        category: 'rental',
        keywords: ['median', 'rent']
    },
    rental_inventory: {
        description: 'Rental Inventory',
        category: 'rental',
        keywords: ['rental', 'inventory']
    },
    // Investor Data
    investor_share: {
        description: 'Investor Share of Sales',
        category: 'investor',
        keywords: ['investor', 'share']
    },
    cash_buyer_share: {
        description: 'Cash Buyer Share',
        category: 'investor',
        keywords: ['cash', 'buyer']
    },
    flipping_rate: {
        description: 'Home Flipping Rate',
        category: 'investor',
        keywords: ['flip', 'flipping']
    },
    // Inventory Data
    inventory: {
        description: 'Active Inventory',
        category: 'inventory',
        keywords: ['inventory', 'active']
    },
    new_listings: {
        description: 'New Listings',
        category: 'inventory',
        keywords: ['new', 'listings']
    },
    // Market Activity
    median_days_on_market: {
        description: 'Median Days on Market',
        category: 'activity',
        keywords: ['days', 'market', 'dom']
    },
    price_cuts: {
        description: 'Price Cuts',
        category: 'activity',
        keywords: ['price', 'cuts', 'reduction']
    },
    // Price Metrics
    price_per_square_foot: {
        description: 'Price per Square Foot',
        category: 'price',
        keywords: ['price', 'square', 'foot', 'sqft']
    }
}
