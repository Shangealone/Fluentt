"""Synthetic diagnostic QA, separate from the saved real model predictions."""
import copy
import pytest

from ml.pronunciation_validation.diagnose_phase3 import clean_phone,leave_speaker_out,match_phones


def test_stress_removal_does_not_collapse_repeated_phones():
    assert [clean_phone(p) for p in ['T','T','AA1']]==['t','t','aa']


def sample():
    return {'sample_id':'fixture1','speaker_id':'s1'}


def test_exact_reference_phone_join_and_native_scale_preserved():
    reference=[{'text':'CAT','phones':['K','AE1','T'],'phones-accuracy':[2,1.8,0]}]
    predicted=[{'word':'CAT','phonemes':[{'phone':p,'score':90,'pherr_prob':.2,'error':False,'gop':-1} for p in ['k','ae','t']]}]
    pairs,diffs=match_phones(sample(),reference,predicted)
    assert not diffs and [p['human_accuracy'] for p in pairs]==[2,1.8,0]
    assert [p['phone_index'] for p in pairs]==[0,1,2]


@pytest.mark.parametrize('actual',[['k','ah','t'],['k','ae'],['k','ae','ae','t']])
def test_variant_missing_and_duplicated_phone_sequences_are_not_force_joined(actual):
    reference=[{'text':'CAT','phones':['K','AE1','T'],'phones-accuracy':[2,2,2]}]
    predicted=[{'word':'CAT','phonemes':[{'phone':p} for p in actual]}]
    pairs,diffs=match_phones(sample(),reference,predicted)
    assert pairs==[] and len(diffs)==1


def test_wrong_word_is_not_joined_even_when_phones_match():
    pairs,diffs=match_phones(sample(),[{'text':'A','phones':['AH0'],'phones-accuracy':[2]}],
        [{'word':'B','phonemes':[{'phone':'ah'}]}])
    assert not pairs and len(diffs)==1


def test_missing_word_is_an_explicit_join_failure():
    with pytest.raises(ValueError,match='Word count'):match_phones(sample(),[{}],[])


def test_leave_one_speaker_out_drops_entire_cluster():
    rows=[{'sample_id':f'{s}-{i}','speaker_id':s,'human_accuracy':i,'model_score':i*10} for s in ['a','b','c'] for i in range(3)]
    result=leave_speaker_out(rows)
    assert len(result)==3
    assert all(r['recordings']==6 and r['speakers']==2 and r['pearson']==1 for r in result)


def test_reference_labels_not_mutated():
    ref=[{'text':'A','phones':['AH0'],'phones-accuracy':[2]}];before=copy.deepcopy(ref)
    match_phones(sample(),ref,[{'word':'A','phonemes':[{'phone':'aa'}]}])
    assert ref==before
