import type {AuditReport} from './audit';
export function auditCsv(report:AuditReport):string{
 const cell=(value:string)=>'"'+(/^[=+@\-\t\r]/.test(value)?"'":"")+value.replaceAll('"','""')+'"';
 const rows=[['URL','Observed at','Signal','Status','Evidence','Next action'],...report.signals.map(s=>[report.url,report.inspectedAt,s.name,s.status,s.detail,s.recommendation])];
 return rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
