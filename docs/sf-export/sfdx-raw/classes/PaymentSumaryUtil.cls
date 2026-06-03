public inherited sharing class PaymentSumaryUtil {
    
    public static final String PAYMENT_TYPE_DRAFT = 'Draft';
    public static final String PAYMENT_TYPE_SETTLEMENT = 'Settlement';
    public static final String PAYMENT_TYPE_PROGRAM_FEE = 'Program Fee';
    public static final String PAYMENT_TYPE_PROGRAM_FEE_SETTLEMENTS = 'Program Fee - Settlements';
    public static final String PAYMENT_TYPE_RETAINER_FEE = 'Retainer Fee';
    public static final String PAYMENT_TYPE_SETUP_FEE = 'Setup Fee';
    public static final String PAYMENT_TYPE_PROCESSOR_FEE = 'Processor Fee';
    public static final String PAYMENT_TYPE_SERVICE_FEE = 'Service Fee';
    public static final String PAYMENT_TYPE_CITADEL_FEE = 'Citadel Fee';
    public static final String PAYMENT_TYPE_ESCROW_AMOUNT = 'Escrow Amount';

    public static final Map<String, String> DRAFT_FEE_RT_PAYMENT_TYPE_MAP = new Map<String, String> {
        'Program_Fee' => PAYMENT_TYPE_PROGRAM_FEE,
        'Retainer_Fee' => PAYMENT_TYPE_RETAINER_FEE,
        'Setup_Fee' => PAYMENT_TYPE_SETUP_FEE,
        'Service_Fee' => PAYMENT_TYPE_SERVICE_FEE,
        'Citadel_Fee' => PAYMENT_TYPE_CITADEL_FEE,
        'Processor_Fee' => PAYMENT_TYPE_PROCESSOR_FEE
    };

    public static final Map<String, String> SETTLEMENT_FEE_RT_PAYMENT_TYPE_MAP = new Map<String, String> {
        'Program_Fee' => PAYMENT_TYPE_PROGRAM_FEE_SETTLEMENTS
    };

    public static final Set<String> PAYMENT_TYPES = new Set<String> {
        PAYMENT_TYPE_SETTLEMENT, PAYMENT_TYPE_PROGRAM_FEE, PAYMENT_TYPE_PROGRAM_FEE_SETTLEMENTS,
        PAYMENT_TYPE_RETAINER_FEE, PAYMENT_TYPE_SETUP_FEE, PAYMENT_TYPE_PROCESSOR_FEE, PAYMENT_TYPE_SERVICE_FEE,
        PAYMENT_TYPE_CITADEL_FEE, PAYMENT_TYPE_ESCROW_AMOUNT, PAYMENT_TYPE_DRAFT
    };

    public static Set<String> getFeeTypes(Set<String> paymentTypes) {
        Set<String> feeTypes = new Set<String>();
        for (String feeType : DRAFT_FEE_RT_PAYMENT_TYPE_MAP.keySet()) {
            String paymentType = DRAFT_FEE_RT_PAYMENT_TYPE_MAP.get(feeType);
            if (paymentTypes.contains(paymentType)) {
                feeTypes.add(feeType);
            }
        }
        return feeTypes;
    }
}