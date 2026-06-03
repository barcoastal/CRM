public Interface PaymentProcessor {
    ProcessorWrapper.API_Response createClient(ProcessorWrapper.CreateClientRequest request, ProcessorWrapper.CreateBankAccountRequest bankAccountRequest);
    ProcessorWrapper.API_Response updateClient(ProcessorWrapper.UpdateClientRequest request);
    ProcessorWrapper.API_Response cancelClient(ProcessorWrapper.CancelClientRequest request);
    ProcessorWrapper.API_Response setCustomerStatus(ProcessorWrapper.SetCustomerStatuRequest request, String customerStatus);
    ProcessorWrapper.API_Response createBankAccount(ProcessorWrapper.CreateBankAccountRequest request);
    ProcessorWrapper.API_Response updateBankAccount(ProcessorWrapper.UpdateBankAccountRequest request);
    ProcessorWrapper.API_Response createDraft(ProcessorWrapper.CreateDraftRequest request);
    ProcessorWrapper.API_Response updateDraft(ProcessorWrapper.UpdateDraftRequest request);
    ProcessorWrapper.API_Response uploadContract(ProcessorWrapper.UploadContractRequest request);
    ProcessorWrapper.API_Response syncPayee(ProcessorWrapper.PayeeRequest request);
    ProcessorWrapper.API_Response syncDrafts(ProcessorWrapper.SyncDraftsRequest request);
    ProcessorWrapper.API_Response getBalances();
    ProcessorWrapper.API_Response getCustomerRecords(Datetime startDateTime, Datetime endDateTime);
    ProcessorWrapper.API_Response getPaymentStatus();
    ProcessorWrapper.API_Response getDebitSchedule(Datetime startDateTime, Datetime endDateTime, Integer currentPage, Integer pageSize);

}