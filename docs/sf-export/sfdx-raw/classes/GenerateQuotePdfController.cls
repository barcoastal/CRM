public with sharing class GenerateQuotePdfController {
    
    public Quote quoteRecord { get; set; }
    
    public GenerateQuotePdfController() {
        String quoteId = ApexPages.currentPage().getParameters().get('quoteId');
        // Retrieve the Quote record based on the quoteId
        quoteRecord = getQuoteRecord(quoteId);
    }
    
    public static Quote getQuoteRecord(String quoteId) {
        return [SELECT
                Estimated_Savings_1__c,
                Estimated_Savings_2__c,
                Estimated_Weekly_Savings_1__c,
                Estimated_Weekly_Savings_2__c,
                New_Total_Debt_1__c,
                New_Total_Debt_2__c,
                New_Weekly_Payment_1__c,
                New_Weekly_Payment_2__c,
                Program_Length_1__c,
                Program_Length_2__c,
                Total_Debt__c,
                Current_Weekly_Payment__c,
                ExpirationDate,
                Account.Name,
                Contact.Name
                FROM Quote
                WHERE Id = :quoteId
                LIMIT 1];
    }
    
    @AuraEnabled
    public static void generatePDFAndSave(String quoteId) {
        Blob pdfBlob = generatePDFContent(quoteId);
        String opportunityName = getOpportunityName(quoteId);
        String dateTimeStamp = Datetime.now().formatGMT('yyyyMMddHHmmss');
        // Create the PDF file title
        String pdfTitle = opportunityName + ' - ' + dateTimeStamp + '.pdf';
        
        // Save PDF on Quote record
        ContentVersion contentVersion = new ContentVersion();
        //contentVersion.Title = 'QuoteAttachment.pdf';
        contentVersion.Title = pdfTitle;
        contentVersion.VersionData = pdfBlob;
        contentVersion.PathOnClient = '/QuoteAttachments/';
        insert contentVersion;
        
        // Associate the ContentVersion with the Quote record
        ContentDocumentLink contentLink = new ContentDocumentLink();
        contentLink.ContentDocumentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :contentVersion.Id].ContentDocumentId;
        contentLink.LinkedEntityId = quoteId;
        contentLink.ShareType = 'V';
        insert contentLink;
    }
    
    public static Blob generatePDFContent(String quoteId) {
        PageReference pdfPage = Page.GenerateQuotePdfPage;
        pdfPage.getParameters().put('quoteId', quoteId);
        if (!Test.isRunningTest()) {
            return pdfPage.getContentAsPDF();
        } else { 
            // Return a placeholder Blob for testing
            Blob placeholderBlob = Blob.valueOf('This is a placeholder PDF for testing purposes.');
            return placeholderBlob;
        }
    }
    
    // To retrieve Opportunity Name 
    public static String getOpportunityName(String quoteId) {
        Quote quote = [SELECT Opportunity.Name FROM Quote WHERE Id = :quoteId LIMIT 1];
        return quote.Opportunity.Name;
    }        
    
}