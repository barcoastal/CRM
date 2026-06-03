public without sharing class ActivityTimelineService {

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getActivityTimelineRecords(String recordId) {
        List<Map<String, Object>> records = new List<Map<String, Object>>();
        Set<Id> relatedRecordIds = new Set<Id>{recordId}; // Initialize with the input recordId
        Set<Id> whoIds = new Set<Id>(); // Store WhoIds for Tasks and Events

        try {
            // Determine the object type of the recordId
            String sObjectType = Id.valueOf(recordId).getSObjectType().getDescribe().getName();

            // If the record is an Account, fetch associated Opportunities
            if (sObjectType == 'Account') {
                for (Opportunity opp : [SELECT Id FROM Opportunity WHERE AccountId = :recordId LIMIT 100]) {
                    relatedRecordIds.add(opp.Id);
                }
            }
            // If the record is an Opportunity, fetch all associated Opportunities for the same Account
            else if (sObjectType == 'Opportunity') {
                Opportunity opp = [SELECT AccountId FROM Opportunity WHERE Id = :recordId LIMIT 1];
                if (opp.AccountId != null) {
                    // Fetch all Opportunities related to the same Account
                    for (Opportunity relatedOpp : [SELECT Id FROM Opportunity WHERE AccountId = :opp.AccountId LIMIT 100]) {
                        relatedRecordIds.add(relatedOpp.Id);
                    }
                    // Also add the Account itself for related activities
                    relatedRecordIds.add(opp.AccountId);
                }
            }
            // For Contacts, Leads, Users, no additional related records are needed
            // relatedRecordIds already contains the recordId

            // Fetch Tasks for all related records and collect WhoIds
            for (Task t : [SELECT Id, CreatedById, CreatedBy.Name, Subject, ActivityDate, WhoId, WhatId, Priority, IsRecurrence, Description, Status, Who.Name, What.Name, CreatedDate, ReminderDateTime
                           FROM Task 
                           WHERE WhatId IN :relatedRecordIds OR WhoId IN :relatedRecordIds]) {
                if (t.WhoId != null) {
                    whoIds.add(t.WhoId);
                }
                // Determine the appropriate date to use for the task
                DateTime taskDate = t.CreatedDate; // Default to CreatedDate
                if (t.ReminderDateTime != null) {
                    taskDate = t.ReminderDateTime;
                }
                records.add(new Map<String, Object>{
                    'Id' => t.Id,
                    'Subject' => t.Subject,
                    'DueDate' => taskDate.format(),
                    'AssignedTo' => t.WhoId,
                    'RelatedTo' => t.WhatId,
                    'WithName' => t.WhoId != null ? t.Who.Name : null,
                    'WhatName' => t.WhatId != null ? t.What.Name : null,
                    'WhatCount' => relatedRecordIds.size(),
                    'WhoCount' => whoIds.size(),
                    'Priority' => t.Priority,
                    'IsRecurring' => t.IsRecurrence,
                    'HasAttachment' => false, // Add logic to check attachments if needed
                    'Status' => t.Status,
                    'RecordType' => 'Task',
                    'Description' => t.Description,
                    'isExpanded' => false,
                    'CreatedById' => t.CreatedById,
                    'CreatedBy' => t.CreatedBy.Name
                });
            }

            // Fetch Events for all related records and collect WhoIds
            for (Event e : [SELECT Id, CreatedById, CreatedBy.Name, Subject, StartDateTime, ActivityDate, WhoId, WhatId, Description, Location, GroupEventType, Who.Name, What.Name 
                            FROM Event 
                            WHERE WhatId IN :relatedRecordIds OR WhoId IN :relatedRecordIds]) {
                if (e.WhoId != null) {
                    whoIds.add(e.WhoId);
                }
                records.add(new Map<String, Object>{
                    'Id' => e.Id,
                    'Subject' => e.Subject,
                    'DueDate' => e.StartDateTime.format(),
                    'AssignedTo' => e.WhoId,
                    'RelatedTo' => e.WhatId,
                    'WithName' => e.WhoId != null ? e.Who.Name : null,
                    'WhatName' => e.WhatId != null ? e.What.Name : null,
                    'WhatCount' => relatedRecordIds.size(),
                    'WhoCount' => whoIds.size(),
                    'RecordType' => 'Event',
                    'Description' => e.Description,
                    'Location' => e.Location,
                    'Attendees' => e.GroupEventType != null ? 'Multiple Attendees' : e.Who.Name,
                    'IsShared' => e.GroupEventType != null,
                    'isExpanded' => false,
                    'CreatedById' => e.CreatedById,
                    'CreatedBy' => e.CreatedBy.Name
                });
            }

            // Fetch EmailMessages for all related records
            for (EmailMessage em : [SELECT Id, CreatedById, CreatedBy.Name, Subject, MessageDate, FromAddress, ToAddress, TextBody, HtmlBody, HasAttachment, RelatedToId, IsOpened
                                    FROM EmailMessage 
                                    WHERE RelatedToId IN :relatedRecordIds 
                                    ORDER BY MessageDate DESC]) {
                records.add(new Map<String, Object>{
                    'Id' => em.Id,
                    'Subject' => em.Subject,
                    'MessageDate' => em.MessageDate.format(),
                    'FromAddress' => em.FromAddress,
                    'ToAddress' => em.ToAddress,
                    'TextBody' => em.TextBody,
                    'HtmlBody' => em.HtmlBody,
                    'HasAttachment' => em.HasAttachment,
                    'IsGroupEmail' => em.ToAddress != null && em.ToAddress.contains(';'),
                    'IsOpened' => em.IsOpened,
                    'RecordType' => 'Email',
                    'RelatedTo' => em.RelatedToId,
                    'EmailMessages' => new List<Object>(), // Placeholder for future thread grouping
                    'isExpanded' => false,
                    'CreatedById' => em.CreatedById,
                    'CreatedBy' => em.CreatedBy.Name
                });
            }

            // Fetch ContentDocumentLinks for all related records
            Set<Id> contentDocumentIds = new Set<Id>();
            for (ContentDocumentLink cdl : [SELECT ContentDocumentId 
                                            FROM ContentDocumentLink 
                                            WHERE LinkedEntityId IN :relatedRecordIds]) {
                contentDocumentIds.add(cdl.ContentDocumentId);
            }

            // Fetch Notes and Files using ContentDocumentLink approach, aligning with the provided snippet
            Set<Id> processedContentDocumentIds = new Set<Id>();
            for (ContentDocumentLink cdl : [SELECT Id, ContentDocumentId, ContentDocument.Title, ContentDocument.Description, ContentDocument.FileType, ContentDocument.FileExtension, ContentDocument.ContentSize, ContentDocument.CreatedById, ContentDocument.CreatedBy.Name, ContentDocument.CreatedDate, ContentDocument.IsArchived
                                            FROM ContentDocumentLink 
                                            WHERE LinkedEntityId IN :relatedRecordIds AND ContentDocument.IsArchived = false]) {
                if (!processedContentDocumentIds.contains(cdl.ContentDocumentId)) {
                    processedContentDocumentIds.add(cdl.ContentDocumentId);
                    // Determine if it's a Note or File based on FileType or other criteria
                    String recordType = (cdl.ContentDocument.FileType == 'SNOTE') ? 'Note' : 'File';
                    String contentString = '';
                    if (recordType == 'Note') {
                        // Fetch ContentNote content if it's a note
                        ContentNote note = [SELECT Content FROM ContentNote WHERE Id = :cdl.ContentDocumentId LIMIT 1];
                        contentString = note.Content != null ? note.Content.toString() : '';
                    }
                    records.add(new Map<String, Object>{
                        'Id' => cdl.ContentDocumentId, // Use ContentDocumentId as the ID, matching the snippet's approach for ContentDocumentLink
                        'Title' => cdl.ContentDocument.Title,
                        'Content' => contentString, // Only for Notes
                        'Description' => cdl.ContentDocument.Description,
                        'FileType' => cdl.ContentDocument.FileType,
                        'FileExtension' => cdl.ContentDocument.FileExtension,
                        'ContentSize' => cdl.ContentDocument.ContentSize,
                        'CreatedById' => cdl.ContentDocument.CreatedById,
                        'CreatedBy' => cdl.ContentDocument.CreatedBy.Name,
                        'CreatedDate' => cdl.ContentDocument.CreatedDate.format(),
                        'RecordType' => recordType, // Set to 'Note' or 'File' to match the filter options in the LWC
                        'isExpanded' => false,
                        'LinkedEntityId' => cdl.Id // Optional: Include the link ID if needed
                    });
                }
            }

            return records;

        } catch (Exception e) {
            throw new AuraHandledException('Error fetching activity timeline records: ' + e.getMessage());
        }
    }
}