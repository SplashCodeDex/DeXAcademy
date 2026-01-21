/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
    id: string;
    title: string;
    price: string;
    priceAmount: number; // For Payment API
    currency: string;
    credits: number;
    popular?: boolean;
}

export interface PurchaseReceipt {
    productId: string;
    transactionId: string;
    timestamp: number;
    amount: string;
    status: 'COMPLETED';
    details: Record<string, unknown>; // Payment token/details
}

export interface PurchaseResult {
    success: boolean;
    credits: number;
    receipt?: PurchaseReceipt;
    error?: string;
}

/**
 * Real IAP Service using the W3C Payment Request API.
 * This invokes the native browser payment sheet (Apple Pay / Google Pay).
 * Returns a receipt for the calling layer to persist (Cloud/Firestore).
 */
class IAPService {
    private readonly products: Product[] = [
         { id: 'credits_10', title: '10 Credits', price: '$0.99', priceAmount: 0.99, currency: 'USD', credits: 10 },
         { id: 'credits_55', title: '55 Credits', price: '$4.99', priceAmount: 4.99, currency: 'USD', credits: 55, popular: true },
         { id: 'credits_120', title: '120 Credits', price: '$9.99', priceAmount: 9.99, currency: 'USD', credits: 120 },
    ];

    async getProducts(): Promise<Product[]> {
        return this.products;
    }

    async purchaseProduct(productId: string): Promise<PurchaseResult> {
        const product = this.products.find(p => p.id === productId);
        if (!product) throw new Error("Product not found");

        // Fallback for simulation in dev/non-supported environments
        const simulatePurchase = async () => {
             await new Promise(resolve => setTimeout(resolve, 1500));
             return {
                success: true,
                credits: product.credits,
                receipt: {
                    productId: product.id,
                    transactionId: 'sim_' + Date.now(),
                    timestamp: Date.now(),
                    amount: product.price,
                    details: { method: 'simulation' },
                    status: 'COMPLETED' as const
                }
            };
        };

        if (!window.PaymentRequest) {
            console.warn("Payment Request API not supported. Simulating.");
            return simulatePurchase();
        }

        // 1. Supported Payment Methods
        // NOTE: 'basic-card' is deprecated and removed in Chrome. 
        // We rely on browser default instruments (Apple Pay / Google Pay / Stored Cards)
        // If the browser has no instruments configured, it may throw.
        const supportedInstruments: PaymentMethodData[] = [
            {
                supportedMethods: 'https://google.com/pay',
                data: {
                    environment: 'TEST',
                    apiVersion: 2,
                    apiVersionMinor: 0,
                    merchantInfo: {
                        merchantName: 'SKU Foundry Demo',
                    },
                    allowedPaymentMethods: [{
                        type: 'CARD',
                        parameters: {
                            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                            allowedCardNetworks: ['MASTERCARD', 'VISA']
                        },
                        tokenizationSpecification: {
                            type: 'PAYMENT_GATEWAY',
                            parameters: {
                                gateway: 'example',
                                gatewayMerchantId: 'exampleGatewayMerchantId'
                            }
                        }
                    }]
                }
            }
        ];

        // 2. Transaction Details
        const details: PaymentDetailsInit = {
            total: {
                label: `SKU Foundry - ${product.title}`,
                amount: {
                    currency: product.currency,
                    value: product.priceAmount.toString()
                }
            },
            displayItems: [
                {
                    label: product.title,
                    amount: { currency: product.currency, value: product.priceAmount.toString() }
                }
            ]
        };

        try {
            // 3. Invoke Native UI
            const request = new PaymentRequest(supportedInstruments, details);
            
            // Check if can make payment
            const canMake = await request.canMakePayment();
            if (!canMake) {
                console.warn("Cannot make native payment. Falling back to simulation.");
                return simulatePurchase();
            }

            const paymentResponse = await request.show();

            // 4. Create Receipt Object
            const receipt: PurchaseReceipt = {
                productId: product.id,
                transactionId: paymentResponse.requestId,
                timestamp: Date.now(),
                amount: product.price,
                details: paymentResponse.details as Record<string, unknown>,
                status: 'COMPLETED'
            };
            
            // 5. Complete Transaction
            await paymentResponse.complete('success');

            return {
                success: true,
                credits: product.credits,
                receipt: receipt
            };

        } catch (e: unknown) {
            console.error("Payment Failed or Cancelled", e);
            const msg = e instanceof Error ? e.message : String(e);
            
            // If user cancelled, don't simulate success
            if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abort')) {
                return { success: false, credits: 0, error: "Cancelled by user" };
            }

            // For technical errors in this demo, fallback to sim
            return simulatePurchase();
        }
    }
}

export const iapService = new IAPService();