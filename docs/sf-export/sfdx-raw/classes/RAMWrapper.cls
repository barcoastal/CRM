public inherited sharing class RAMWrapper {
    
    public FINAL static Map<String, String> ACCOUNT_TYPE_MAP = new Map<String, String> {
        'Checking' => 'CONSUMER_DEBIT_CHECKING',
        'Savings' => 'CONSUMER_DEBIT_SAVINGS'
    };
    public FINAL static Map<String, String> ACCOUNT_STATUS_MAP = new Map<String, String> {
        'Active' => 'ACTIVE',
        'Hold' => 'ON_HOLD',
        'Suspended' => 'CANCELLED'
    };
    public static String getBankAccountType(String accountStatus) {
        if (String.isNotBlank(accountStatus) && ACCOUNT_TYPE_MAP.containsKey(accountStatus)) {
            return ACCOUNT_TYPE_MAP.get(accountStatus);
        }
        return null;
    }
    public static String getAccountStatus(String accType) {
        if (String.isNotBlank(accType) && ACCOUNT_STATUS_MAP.containsKey(accType)) {
            return ACCOUNT_STATUS_MAP.get(accType);
        }
        return null;
    }
    public static String docType = 'ACH_AGREEMENT';
    
    public static Map<String, String> createClientMap = new Map<String, String> {
        'clientNumber' => 'ClientID',
        'firstName' => 'Firstname',
        'lastName' => 'Lastname',
        'firstName2' => 'FirstName2',
        'lastName2' => 'lastname2',
        'email' => 'EmailAddress',
        'ssn' => 'TaxID',
        'taxId2' => 'TaxID2',
        'address' => 'StreetAddress',
        'city' => 'City',
        'postalCode' => 'ZIP',
        'state' => 'StateAbbreviation',
        'address2' => 'StreetAddress2',
        'city2' => 'City2',
        'postalCode2' => 'ZIP2',
        'state2' => 'StateAbbreviation2',
        'phone' => 'Phone1',
        'phone2' => 'Phone2',
        'phone3' => 'Phone3',
        'dob' => 'DOB1',
        'dob2' => 'DOB2',
        'accountStatus' => 'AccountStatus',
        'affiliateId' => 'AffiliateID',
        'feeSplitGroupId' => 'FeeSplitGroupID',
        'accountHoldStatus' => 'AccountHoldStatus'
    };
    public static List<String> createClientRequiredField = new List<String> {
        'firstName', 'lastName', 'email',
        'ssn', 'address', 'city', 'postalCode', 'state',
        'phone', 'dob', 'accountStatus', 'affiliateId', 'feeSplitGroupId', 'accountHoldStatus', 'clientNumber'
    };
    public static Map<String, String> updateClientMap = new Map<String, String> {
        'externalRAMId' => 'ClientID',
        'firstName' => 'Firstname',
        'lastName' => 'Lastname',
        'firstName2' => 'FirstName2',
        'lastName2' => 'lastname2',
        'email' => 'EmailAddress',
        'ssn' => 'TaxID',
        'taxId2' => 'TaxID2',
        'address' => 'StreetAddress',
        'city' => 'City',
        'postalCode' => 'ZIP',
        'state' => 'StateAbbreviation',
        'address2' => 'StreetAddress2',
        'city2' => 'City2',
        'postalCode2' => 'ZIP2',
        'state2' => 'StateAbbreviation2',
        'phone' => 'Phone1',
        'phone2' => 'Phone2',
        'phone3' => 'Phone3',
        'dob' => 'DOB1',
        'dob2' => 'DOB2',
        'accountStatus' => 'AccountStatus',
        'affiliateId' => 'AffiliateID',
        'feeSplitGroupId' => 'FeeSplitGroupID',
        'accountHoldStatus' => 'AccountHoldStatus'
    };
    public static List<String> updateClientRequiredField = new List<String> {
        'firstName', 'lastName', 'email',
        'ssn', 'address', 'city', 'postalCode', 'state',
        'phone', 'dob', 'accountStatus', 'affiliateId', 'feeSplitGroupId', 'accountHoldStatus', 'externalRAMId'
    };
    public static Map<String, String> createBankAccountMap = new Map<String, String> {
        'clientNumber' => 'clientid',
        'bankAccountNumber' => 'Accountnumber',
        'nameOnAccount' => 'NameonAccount',
        'routingNumber' => 'Routing',
        'bankName' => 'bankname',
        'bankAccountType' => 'AccountType'
    };
    public static List<String> bankAccountRequiredField = new List<String> {
        'bankAccountNumber', 'nameOnAccount', 'routingNumber',
        'bankName', 'accountType'
    };
    public static Map<String, String> updateBankAccountMap = new Map<String, String> {
        'externalRAMId' => 'clientid',
        'bankAccountNumber' => 'Accountnumber',
        'nameOnAccount' => 'NameonAccount',
        'routingNumber' => 'Routing',
        'bankName' => 'bankname',
        'bankAccountType' => 'AccountType'
    };
    public static Map<String, String> createDraftMap = new Map<String, String> {
        'clientExternalProcId' => 'clientID',
        'recordId' => 'extendedID',
        'totalAmountExclMPA' => 'TotalPaymentAmount',
        'paymentAmount' => 'savings',
        'paymentDate' => 'paymentdate'
    };
    public static List<String> createDraftRequiredField = new List<String> {
        'clientExternalProcId', 'totalAmountExclMPA', 'paymentAmount',
        'paymentDate'
    };
    public static Map<String, String> draftFeeMap() {
        return RAMFeeMapSettingMDT.getRAMDraftFeeMap();
    }
    public static Map<String, String> updateDraftMap = new Map<String, String> {
        'clientExternalProcId' => 'clientID',
        'externalRAMId' => 'PID',
        'totalAmountExclMPA' => 'TotalPaymentAmount',
        'paymentAmount' => 'savings',
        'paymentDate' => 'paymentdate'
    };
    public static List<String> updateDraftRequiredField = new List<String> {
        'clientExternalProcId', 'externalRAMId', 'totalAmountExclMPA', 'paymentAmount',
        'paymentDate'
    };
    public static Map<String, String> createSettlementMap = new Map<String, String> {
        'recordId' => 'RemoteID',
        'payeeId' => 'PayeeID',
        'settlementAmount' => 'Amount'
    };
    
    public static Set<String> contractMap = new Set<String>{
        'Coastal Debt - Business Debt Resolution and Settlement Agreement',
        'Citadel Legal Plan',
        'Reliant Dedicated Account Agreement And Reliant Services Terms And Conditions'
    };
    
    public static Map<String, String> uploadContractMap = new Map<String, String> {
        'clientExtProcId' => 'CustomerID',
        'clientSFId' => 'RemoteID',
        'contractDetails' => 'Contract'
    }; 
    
    public static Map<String, String> cancelDraftMap = new Map<String, String> {
        'clientExternalProcId' => 'clientID',
        'externalRAMId' => 'PID',
        'totalAmountExclMPA' => 'TotalPaymentAmount',
        'paymentAmount' => 'savings',
        'paymentDate' => 'paymentdate'
    };       

    /* This wrapper class is used for parsing the response from RAM Processor. Since it is case sensitive, we couldn't follow naming conventions. */
    public class RAMS_RESPONSE {
        public String RequestID;
        public String PrimaryKeyID;
        public String Success;
        public String Message;
        public String Records;
        public String ProcessData;
    }
}