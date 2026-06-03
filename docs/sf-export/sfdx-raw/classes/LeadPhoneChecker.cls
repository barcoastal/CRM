public without sharing class LeadPhoneChecker {
    /* @AuraEnabled(cacheable=false)
    public static String runDuplicateCheckBatch(List<String> phoneNumbers,String parentId) {
        Database.executeBatch(new CheckLeadPhoneNumberBatch(phoneNumbers, parentId), 200);
        return 'Batch started';
    }

     @AuraEnabled
    public static void updateContentVersionAndFlag(Id contentVersionId) {
        if (contentVersionId == null) return;

        ContentVersion cv = [
            SELECT Id, Title, Lead_Extract_Pending__c
            FROM ContentVersion
            WHERE Id = :contentVersionId
            LIMIT 1
        ];

        cv.Lead_Extract_Pending__c = true;

        String formattedDate = DateTime.now().format('yyyyMMdd_HHmmss');
        cv.Title = 'AllLead_' + formattedDate;

        update cv;
    }
*/
    @AuraEnabled
    public static Id uploadFile(String base64Data, String fileName, String recordId) {
        if (base64Data.contains(',')) {
            base64Data = base64Data.substring(base64Data.indexOf(',') + 1);
        }

        ContentVersion contentVersion = new ContentVersion();
        contentVersion.Title = fileName;
        contentVersion.PathOnClient = '/' + fileName;
        contentVersion.VersionData = EncodingUtil.base64Decode(base64Data);
        insert contentVersion;

        ContentVersion insertedVersion = [
            SELECT Id, ContentDocumentId
            FROM ContentVersion
            WHERE Id = :contentVersion.Id
            LIMIT 1
        ];

        ContentDocumentLink contentLink = new ContentDocumentLink();
        contentLink.ContentDocumentId = insertedVersion.ContentDocumentId;
        contentLink.LinkedEntityId = recordId;
        contentLink.ShareType = 'V';        
        contentLink.Visibility = 'AllUsers'; 
        insert contentLink;

        Suppression_List__e event = new Suppression_List__e(
            ContentDocumentId__c = insertedVersion.ContentDocumentId,
            ParentId__c = recordId
        );
        EventBus.publish(event);

        return insertedVersion.ContentDocumentId;
    }




    /*@AuraEnabled(cacheable=false)
    public static Map<String, List<String>> checkLeadPhoneNumbers(List<String> phoneNumbers) {
        Set<String> cleanedPhones = new Set<String>();
        for (String phone : phoneNumbers) {
            if (String.isNotBlank(phone)) {
                cleanedPhones.add(phone.trim());
            }
        }

        Map<String, Lead> leadPhoneMap = new Map<String, Lead>();
        for (Lead l : [
            SELECT Id, Phone,Formated_Phone__c
            FROM Lead
            WHERE Formated_Phone__c IN :cleanedPhones
        ]) {
            if (String.isNotBlank(l.Formated_Phone__c)) {
                leadPhoneMap.put(l.Formated_Phone__c.trim(), l);
            }
        }

        List<String> duplicates = new List<String>();
        List<String> nonDuplicates = new List<String>();

        for (String phone : cleanedPhones) {
            if (leadPhoneMap.containsKey(phone)) {
                duplicates.add(phone);
            } else {
                nonDuplicates.add(phone);
            }
        }

        return new Map<String, List<String>> {
            'duplicates' => duplicates,
            'nonDuplicates' => nonDuplicates
        };
    }
    */
    @AuraEnabled
    public static List<Id> uploadLeadsCSV(List<String> duplicateRows, List<String> nonDuplicateRows, String parentId) {
        List<Id> contentVersionIds = new List<Id>();
        DateTime now = System.now();
        String timestamp = now.format('yyyy-MM-dd_HH-mm-ss');

        if ((duplicateRows == null || duplicateRows.isEmpty()) &&
            (nonDuplicateRows == null || nonDuplicateRows.isEmpty())) {
            throw new AuraHandledException('No data to upload.');
        }
        List<ContentDocumentLink> docLinks = new List<ContentDocumentLink>();

        if (nonDuplicateRows != null && !nonDuplicateRows.isEmpty()) {
            ContentVersion nonDupCV = new ContentVersion();
           nonDupCV.Title = 'NonDuplicateLeads_' + timestamp;
			nonDupCV.PathOnClient = 'NonDuplicateLeads_' + timestamp + '.csv';
            nonDupCV.VersionData = Blob.valueOf(String.join(nonDuplicateRows, '\n'));
            insert nonDupCV;
            List<ContentVersion> versionList = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :nonDupCV.Id LIMIT 1];
            docLinks.add(new ContentDocumentLink(
                ContentDocumentId = versionList[0].ContentDocumentId,
                LinkedEntityId = parentId,
                ShareType = 'I',
                Visibility = 'AllUsers'
            ));

            contentVersionIds.add(nonDupCV.Id);
        }

        if (duplicateRows != null && !duplicateRows.isEmpty()) {
            ContentVersion dupCV = new ContentVersion();
            dupCV.Title = 'DuplicateLeads_' + timestamp;
            dupCV.PathOnClient = 'DuplicateLeads_' + timestamp+'.csv';
            dupCV.VersionData = Blob.valueOf(String.join(duplicateRows, '\n'));
            insert dupCV;
             List<ContentVersion> versionList = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :dupCV.Id LIMIT 1];
            docLinks.add(new ContentDocumentLink(
                ContentDocumentId = versionList[0].ContentDocumentId,
                LinkedEntityId = parentId,
                ShareType = 'I',
                Visibility = 'AllUsers'
            ));
            
            contentVersionIds.add(dupCV.Id);
        }
        
         if (!docLinks.isEmpty()) {
            insert docLinks;
        } 

        return contentVersionIds;
    }

}