public inherited sharing class SASWrapper {

    public static Map<String, String> createClientMap = new Map<String, String> {
        'recordId' => 'RemoteID',
        'firstName' => 'FirstName',
        'lastName' => 'LastName',
        'companyName' => 'Company',
        'ssn' => 'SsnTid',
        'dob' => 'Dob',
        'email' => 'Email',
        'phone' => 'Phone1',
        'address' => 'Address1',
        'address2' => 'Address2',
        'city' => 'City',
        'state' => 'State',
        'postalCode' => 'PostalCode',
        'country' => 'Country',
        'totalDebt' => 'TotalValue',
        'invoiceNumber' => 'InvoiceNumber',
        'programStartDate' => 'StartDate',
        'programEndDate' => 'EndDate',
        'contractDetails' => 'Contract'
    };

    public static Map<String, String> updateClientMap = new Map<String, String> {
        'processorId' => 'CustomerID',
        'recordId' => 'RemoteID',
        'firstName' => 'FirstName',
        'lastName' => 'LastName',
        'companyName' => 'Company',
        'ssn' => 'SsnTid',
        'dob' => 'Dob',
        'email' => 'Email',
        'phone' => 'Phone1',
        'address' => 'Address1',
        'city' => 'City',
        'state' => 'State',
        'postalCode' => 'PostalCode',
        'country' => 'Country',
        'totalDebt' => 'TotalValue',
        'invoiceNumber' => 'InvoiceNumber',
        'programStartDate' => 'StartDate',
        'programEndDate' => 'EndDate',
        'contractDetails' => 'Contract'
    };

    public static Map<String, String> createBankAccountMap = new Map<String, String> {
        'recordId' => 'RemoteID',
        'bankAccountNumber' => 'BankAccountNumber',
        'routingNumber' => 'BankRoutingNumber',
        'paymentType' => 'PaymentType',
        'clientProcessorId' => 'CustomerID'
    };

    public static Map<String, String> updateBankAccountMap = new Map<String, String> {
        'recordId' => 'RemoteID',
        'bankAccountNumber' => 'BankAccountNumber',
        'routingNumber' => 'BankRoutingNumber'
    };

    public static Map<String, String> createDraftMap = new Map<String, String> {
        'clientExternalProcId' => 'CustomerID',
        'recordId' => 'RemoteID',
        'totalAmount' => 'Amount',
        'paymentDate' => 'Date',
        'payouts' => 'Payouts'
    };

    public static Map<String, String> updateDraftMap = new Map<String, String> {
        'clientExternalProcId' => 'CustomerID',
        'recordId' => 'RemoteID',
        'externalSASId' => 'DebitID',
        'totalAmount' => 'Amount',
        'paymentDate' => 'Date',
        'payouts' => 'Payouts'
    };

    public static Map<String, String> cancelDraftMap = new Map<String, String> {
        'clientExternalProcId' => 'CustomerID',
        'externalSASId' => 'DebitID'
    };
    
    public static Map<String, String> cancelDebitLabelsMap = new Map<String, String> {
        'clientExternalProcId' => 'Client SAS Id',
        'externalSASId' => 'Draft SAS Id'
    };

    public static Map<String, String> uploadContractMap = new Map<String, String> {
        'clientExtProcId' => 'CustomerID',
        'clientSFId' => 'RemoteID',
        'contractDetails' => 'Contract'
    };

    public static Map<String, String> createSettlementMap = new Map<String, String> {
        'recordId' => 'RemoteID',
        'payeeId' => 'PayeeID',
        'settlementAmount' => 'Amount'
    };

    public class CreateClient {
        public String RemoteID;
        public String CustomerID;
        public String FirstName;
        public String LastName;
        public String Company;
        public String SsnTid;
        public String Dob;
        public String Email;
        public String Phone1;
        public String Address1;
        public String Address2;
        public String City;
        public String State;
        public String PostalCode;
        public String Country;
        public String TotalValue;
        public String InvoiceNumber;
        public String StartDate;
        public String EndDate;
        public Blob Contract;
    }

    public class CancelClient {
        public String RemoteID;
        public String CustomerID;
    }
    
    public class SetCustomerStatus {
        public String RemoteID;
        public String CustomerStatusID;
    }    

    public class SyncContract {
        public String CustomerID;
        public String RemoteID;
        public Blob Document;
        public String FileName;
    }

    public class SyncPayee {
        public String PayeeID;
        public String RemoteID;
        public String FirstName;
        public String LastName;
        public String Company;
        public String SsnTid;
        public String Email;
        public String Phone1;
        public String Address1;
        public String City;
        public String State;
        public String PostalCode;
        public String Country;
    }

    public class DebitSchedules {
        public List<Debit> createDrafts;
        public List<Debit> addDrafts;
        public List<Debit> updateDrafts;
        public List<Debit> cancelDrafts;
    }

    public class DebitSchedule {
        public String CustomerID;
        public String RemoteID;
        public String DebitScheduleID;
        public List<Debit> Debits;
    }

    public class Debit {
        public String DebitRemoteID;
        public String DebitID;
        public String Amount;
        public String Date_x;
        public List<Payout> Payouts;
    }

    public class Payout {
        public String PayeeID;
        public String Amount;
        public String PayoutDate;
    }

    public class SettlmentSchedule {
        public String CustomerID;
        public String RemoteID;
        public String DebitScheduleID;
        public List<Settlement> Settlements;
        public List<Settlement> Payouts;
    }

    public class Settlement {
        public String PayoutID;
        public String PayeeID;
        public String Amount;
        public String PayoutDate;
        public String Date_x;
    }

    public class SAS_RESPONSE {
        public String RequestID;
        public String PrimaryKeyID;
        public String Success;
        public String Message;
        public String Records;
        public String ProcessData;
        public List<SAS_RESPONSE_DATA> JsonData;
    }

    public class ProcessDataDetails {
        public String id;
        public String remoteid;
        public Decimal balance;
    }

    public class SAS_RESPONSE_DATA {
        public String DebitID;
        public String PayoutID;
        public String Success;
        public String Message;
    }
    
    public class UpdateDebit {
        public String StartDate;
        public String EndDate;
        public String CurrentPage;
        public String PageSize;
    }

    public class GetCustomerBySFId {
        public String RemoteID;
    }

    public class GetDebitScheduleBySFId {
        public String RemoteID;
        public String CustomerID;
    }
}