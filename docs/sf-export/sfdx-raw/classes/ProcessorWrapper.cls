public inherited sharing virtual class ProcessorWrapper {
    
    public class CreateClientRequest {
        public ClientWrapper clientWrap;
    }

    public class UpdateClientRequest {
        public ClientWrapper clientWrap;
    }

    public class CancelClientRequest {
        public ClientWrapper clientWrap;
    }
    
    public class SetCustomerStatuRequest {
        public ClientWrapper clientWrap;
    }

    public class CreateBankAccountRequest {
        public BankAccountWrapper bankAccountWrap;
    }

    public class UpdateBankAccountRequest {
        public BankAccountWrapper bankAccountWrap;
    }

    public class CreateDraftRequest {
        public DraftWrapper draftWrap;
    }

    public class UpdateDraftRequest {
        public DraftWrapper draftWrap;
    }

    public class SyncDraftsRequest {
        public List<DraftWrapper> draftWrapList;
        public String apiMethod;
    }

    public class SyncSettlementsRequest {
        public List<SettlementWrapper> settlementWrapList;
        public String apiMethod;
    }

    public class UploadContractRequest {
        public FileWrapper fileWrap;
    }

    public class CreatePayeeRequest {
        public ClientWrapper clientWrap;
    }

    public class PayeeRequest {
        public ClientWrapper clientWrap;
    }

    public class CreateSettlementRequest {
        public SettlementWrapper settlementWrap;
    }

    public class API_Response {
        public Boolean isSuccess;
        public String message;
        public String externalId;
        public String sfId;
        public String processData;
        public String status;
        public String statusCode;
        public Integer recordsCount;
        public Decimal balance;
        public List<LineItemResponse> results;
        public GetDebitScheduleResponse getDebits;
        public API_Response() {
            isSuccess = false;
        }
    }

    public class LineItemResponse {
        public String externalId;
        public String sfId;
        public String status;
        public String statusCode;
        public String processData;
        public Boolean isSuccess;
        public String errorMessage;
    }
    
    public class GetUpdatedSavingResponse {
        public String externalId;
        public Decimal balance;
    }

    public class GetClientTransactionsByUpdateDateResponse {
        public String status;
        public String clientExternalId;
        public String draftExternalId;
    }

    public class GetDebitScheduleResponse {
        public String debitScheduleId;
        public Map<String, String> sfIdSasIdMap;
    }
}